-- Astrogen clean Paperclip article parent dedupe guard.
--
-- Purpose:
-- - allow exactly one open top-level article parent per normalized article title;
-- - force writer/validator/image/layout/CMS recovery to continue as child issues;
-- - keep the guard company-scoped to the clean Astrogen company only.

CREATE OR REPLACE FUNCTION public.astrogen_article_parent_key(input_title text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN input_title IS NULL THEN NULL
    WHEN input_title !~* '^\s*Стаття:' THEN NULL
    WHEN input_title !~* '[—–]\s*підготувати чернетку\s*$' THEN NULL
    ELSE NULLIF(
      lower(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(input_title, '^\s*Стаття:\s*["“”«»]*\s*', '', 'i'),
              '\s*["“”«»]*\s*[—–]\s*підготувати чернетку\s*$', '', 'i'
            ),
            '["“”«»]', '', 'g'
          ),
          '\s+', ' ', 'g'
        )
      ),
      ''
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.astrogen_prevent_duplicate_article_parent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_key text;
  v_existing record;
BEGIN
  IF NEW.company_id = 'cb7b5231-2da0-4e91-b4af-538d8f1ca263'::uuid
     AND NEW.parent_id IS NULL
     AND NEW.hidden_at IS NULL
     AND NEW.status NOT IN ('done', 'cancelled') THEN
    v_key := public.astrogen_article_parent_key(NEW.title);
    IF v_key IS NOT NULL THEN
      SELECT id, identifier, title
        INTO v_existing
      FROM issues
      WHERE company_id = NEW.company_id
        AND id <> NEW.id
        AND parent_id IS NULL
        AND hidden_at IS NULL
        AND status NOT IN ('done', 'cancelled')
        AND public.astrogen_article_parent_key(title) = v_key
      ORDER BY created_at DESC, issue_number DESC
      LIMIT 1;

      IF FOUND THEN
        RAISE EXCEPTION 'Duplicate Astrogen article parent blocked for key "%". Reuse canonical issue % (%) and create a recovery child instead.',
          v_key,
          COALESCE(v_existing.identifier, v_existing.id::text),
          v_existing.id
          USING ERRCODE = '23505';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS astrogen_prevent_duplicate_article_parent_trg ON public.issues;
CREATE TRIGGER astrogen_prevent_duplicate_article_parent_trg
BEFORE INSERT OR UPDATE OF company_id, parent_id, title, status, hidden_at
ON public.issues
FOR EACH ROW
EXECUTE FUNCTION public.astrogen_prevent_duplicate_article_parent();

DROP INDEX IF EXISTS astrogen_article_parent_open_dedupe_uq;
CREATE UNIQUE INDEX astrogen_article_parent_open_dedupe_uq
ON public.issues (company_id, public.astrogen_article_parent_key(title))
WHERE company_id = 'cb7b5231-2da0-4e91-b4af-538d8f1ca263'::uuid
  AND parent_id IS NULL
  AND hidden_at IS NULL
  AND status NOT IN ('done', 'cancelled')
  AND public.astrogen_article_parent_key(title) IS NOT NULL;
