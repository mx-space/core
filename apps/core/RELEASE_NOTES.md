## TL;DR

Uploads can now be converted to WebP and WebM automatically, and bucket files get their own page to browse and delete.

## Highlights

A new **Media processing** section under Settings → Storage converts uploads before they are stored. Images from the admin and reader comment images become WebP, with adjustable quality, compression effort, lossless mode and a maximum edge length. Videos are transcoded to WebM (VP9 + Opus) with adjustable CRF, encoder speed, audio bitrate and a maximum height. Both switches are off by default, so existing behaviour is unchanged until you turn them on.

When video conversion is on, the upload waits for the transcode to finish before returning the link, and S3 video uploads become subject to the video size limit. SVG and files that are already WebP or WebM are stored as-is. If the transcode fails, the upload reports an error rather than silently storing the original.

The files area now has a dedicated page for files stored in S3, with paging and a detail view for each file. You can delete a file straight from the bucket there, and the confirmation warns you when the file is still referenced by content, which makes it easier to clean up storage left behind by earlier uploads without breaking published posts.

## Changes

### Features

- Convert admin and comment image uploads to WebP, and video uploads to WebM, with tunable encoding settings ([ee2ad79](https://github.com/mx-space/core/commit/ee2ad79bdd67a6885adc8abe3fc7408324943343)).
- Browse, inspect and delete S3 bucket files from their own page in the admin ([1e14e4b](https://github.com/mx-space/core/commit/1e14e4ba6107fdbbea0a3f55831b31db087dcd45)).

### Bug Fixes

- Updated `qs` to 6.16.1 to pick up a security fix ([#2885](https://github.com/mx-space/core/pull/2885)).

## Upgrade Notes

The Docker image now includes `ffmpeg` for video conversion. If you run the server outside the official image and plan to enable video conversion, install `ffmpeg` with the `libvpx-vp9` and `libopus` encoders on the host.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v15.6.1...v15.7.0
