# mod.io release package

Create a clean, validated upload package from the repository root:

```powershell
npm run package:modio
```

The command builds the current application and creates:

- `release/Talespire_CharSheet/`: a clean folder whose contents may be zipped
  directly.
- `release/Talespire_CharSheet-<version>-modio.zip`: the ready-to-upload file.

The ZIP is validated to ensure that `manifest.json`, `index.html`, `script.js`,
`style.css`, and `README.md` are at its root, with no extra wrapper directory.
It also rejects server-side Supabase secrets if one is accidentally included.

Upload the generated ZIP from `release/` to the file release section of the
Symbiote on mod.io. Do not zip the repository itself: it contains development
dependencies, source files, local configuration, and user-owned local storage.

When testing the mod.io installation, disable or remove any manually installed
copy with the same interop ID. TaleSpire rejects duplicate Symbiote interop IDs.
