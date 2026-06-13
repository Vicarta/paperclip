export function GoogleDriveDocsSettingsPage() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 860 }}>
      <h1>Google Drive Docs Agent Tools</h1>
      <p>
        Configure a Google service-account JSON secret, an optional allowed Drive folder,
        and default sharing rules. Agents can create and update Google Docs but never see
        the plaintext credentials.
      </p>
      <h2>Expected Use</h2>
      <ol>
        <li>Store the service-account JSON as a Paperclip backend secret.</li>
        <li>Share the target Google Drive folder with the service account email.</li>
        <li>Set that folder as <code>defaultFolderId</code> and optionally allowlist it.</li>
        <li>Let agents call <code>google_doc_create_from_html</code> and send the returned URL.</li>
      </ol>
    </main>
  );
}
