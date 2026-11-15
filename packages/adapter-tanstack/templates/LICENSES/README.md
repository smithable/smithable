# Third-party notices

This folder keeps the license texts of code copied into the app's source, so they travel with
every copy of the app, in the container image too. Libraries installed from npm carry their
own licenses in `node_modules/`.

- `shadcn-ui.txt`: the components in `src/components/ui/` (MIT).
- `hallmark-MIT.txt`: adapted Hallmark theme palettes and design data (MIT),
  Copyright (c) 2026 Hallmark contributors, https://github.com/Nutlope/hallmark.
- `tweakcn-Apache-2.0.txt`: adapted tweakcn theme palettes (Apache-2.0),
  https://github.com/jnsahaj/tweakcn.

Smithable converts these palettes to its theme vocabulary, derives missing modes
and adjusts field edges so controls remain visible.

The app kit in `src/kit/` comes under the Zero-Clause BSD license, which asks nothing of you;
the generated code is yours.
