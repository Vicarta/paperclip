# Company Workspace Permissions

## Problem

Paperclip company workspaces can be mounted into more than one runtime:

- Paperclip app / agent runtime writes through the app container user (`node`, host uid `1000`, host user `oc` on the current server).
- File Browser for Astrogen writes as host uid `1002`, host user `paperclip`.

If a company workspace is owned only by one of these users, agents can fail with `Permission denied` when creating or updating files even though another tool can still browse or edit the same tree.

This happened on the legacy Astrogen workspace:

```text
/home/paperclip/astrogen
```

The workspace was owned by `paperclip:paperclip`, while Paperclip app/agents wrote as `oc`. Some directories had an `oc` ACL entry, but the ACL mask on existing directories made it effective as read/execute only. New file creation failed under paths such as:

```text
/home/paperclip/astrogen/docs/reference/products
```

## Required Policy

Every mounted company workspace must be writable by all runtime users that can create company files.

For the current server this means:

- `oc` must be able to traverse `/home/paperclip` and read/write/create inside the managed company workspace.
- `paperclip` must retain read/write/create access for File Browser and legacy tooling.
- Default ACLs must be set on directories so new files created by either user remain editable by both users.

Do not solve this by a one-way `chown` unless every runtime has been migrated to the same uid/gid. A one-way ownership change can fix agents while breaking File Browser, or the reverse.

## Live Fix Pattern

Use this pattern for a mounted company workspace:

```bash
ROOT=/home/paperclip/astrogen

setfacl -m u:oc:--x /home/paperclip

find "$ROOT" \
  \( -path "$ROOT/.git" -o -path '*/.git' -o -path '*/node_modules' -o -path '*/output' \) -prune \
  -o -exec setfacl -m u:oc:rwX,u:paperclip:rwX,m:rwx {} +

find "$ROOT" \
  \( -path "$ROOT/.git" -o -path '*/.git' -o -path '*/node_modules' -o -path '*/output' \) -prune \
  -o -type d -exec setfacl -m d:u:oc:rwx,d:u:paperclip:rwx,d:m:rwx {} +
```

Verification:

```bash
sudo -u oc bash -lc 'touch /home/paperclip/astrogen/docs/reference/products/.acl-test-oc'
sudo -u paperclip bash -lc 'echo ok >> /home/paperclip/astrogen/docs/reference/products/.acl-test-oc'
sudo -u paperclip bash -lc 'touch /home/paperclip/astrogen/docs/reference/products/.acl-test-paperclip'
sudo -u oc bash -lc 'echo ok >> /home/paperclip/astrogen/docs/reference/products/.acl-test-paperclip'
rm -f /home/paperclip/astrogen/docs/reference/products/.acl-test-oc \
  /home/paperclip/astrogen/docs/reference/products/.acl-test-paperclip
```

## New Company Workspaces

Prefer the canonical multi-company mount:

```text
/home/paperclip/companies/{client_key}
```

Before agents are allowed to write there, run the same cross-runtime write verification. If File Browser or another tool writes to that workspace under a different uid/gid, add that runtime user to the ACL policy.

## Operational Rule

When a Paperclip task fails with `Permission denied` inside a company workspace, first check:

```bash
id oc
id paperclip
docker inspect paperclip-app-1 --format '{{range .Mounts}}{{println .Source "->" .Destination "rw=" .RW}}{{end}}'
getfacl -p /home/paperclip /home/paperclip/astrogen /home/paperclip/astrogen/docs/reference/products
```

Then fix the workspace ACL/default ACL instead of patching only the one failing directory.
