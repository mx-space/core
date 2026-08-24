## TL;DR

The admin editor can now insert file attachments, and local uploads without an explicit cap again respect the 6MB plugin limit.

## Highlights

Authors can attach files from the admin rich editor while writing posts and notes. The file is uploaded with progress, stored as a file object, and rendered in both the editor preview and the published view. Attached files stay linked to the content the same way images do, so they are not swept as unused objects while the post still references them.

Local attachment and image uploads, and replacements under PUT `/files/:type/:name`, again inherit the 6MB multipart limit when no explicit maximum is passed. A recent path that forwarded an undefined size cap overwrote that default, so the server accepted files of any size. Endpoints that set their own limit keep that override; only the unbounded fallback is closed.

## Changes

### Features

- Insert file attachments in the admin editor; referenced file URLs stay in the content file lifecycle ([ddfcc57](https://github.com/mx-space/core/commit/ddfcc57ed95700cd76ca2e86c9b067a0fc5e1c57))

### Bug Fixes

- Restore the 6MB default upload size for local attachments, images, and PUT `/files` replacements that do not set their own limit ([e4593b0](https://github.com/mx-space/core/commit/e4593b0df4927a0bc631a2143715d161ce99191e))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v14.3.1...v14.4.0
