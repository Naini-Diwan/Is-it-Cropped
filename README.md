# Is-it-Cropped

An advanced, browser-based scan and crop application for processing multiple document images at once. Upload scans or PDFs, define precise crop zones, correct rotation, and export a batch of cleanly cropped images with customizable formatting, filenames, and metadata — all client-side, with no server or upload required.

**Live demo:** https://naini-diwan.github.io/Is-it-Cropped/

---

## Features

- **Multi-image and PDF support** — upload scanned images directly, or a PDF, which is automatically split into per-page images for editing.
- **Precise crop zones** — define multiple crop regions per scan, each with independent position, size, and rotation.
- **Rotation correction** — fine-tune skewed scans before export.
- **Border customization** — add a configurable border color and width to exported crops.
- **Export controls** — choose aspect ratio, output format (JPEG/PNG), image quality, background fill or transparency, capture margin, and feathering.
- **Batch export** — export all crops as a single ZIP archive with a customizable filename template.
- **Embedded metadata** — attach title, description, tags, author, and creation date to exports.

## Tech Stack

- [React 19](https://react.dev/) with TypeScript
- [Vite](https://vitejs.dev/) for development and bundling
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [JSZip](https://stuk.github.io/jszip/) for batch ZIP export
- [Lucide](https://lucide.dev/) for icons
- [PDF.js](https://mozilla.github.io/pdf.js/) (loaded via CDN) for PDF-to-image conversion


## Project Structure

```
.
├── .github/workflows/    # CI/CD — GitHub Pages deployment
├── assets/                # Static assets
├── src/
│   ├── components/        # React components (crop canvas, editor, export builder)
│   ├── App.tsx             # Application root
│   ├── main.tsx             # Entry point
│   ├── types.ts              # Shared TypeScript types
│   └── index.css              # Global styles / Tailwind entry
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Privacy

All image processing happens entirely in the browser. Scans and PDFs are never uploaded to a server — files are read, cropped, and exported locally using the Canvas API and JSZip.

## Author

**Naini Diwan**

- [LinkedIn Profile](https://www.linkedin.com/in/naini-diwan-profile786/)
- [Portfolio](https://naini-diwan.github.io/Hello-Naini/)



## License
Copyright © 2026 Naini Diwan. All rights reserved.
