# Mint writing workspace

The writing view has grouped Project, Workspace, and Appearance menus, a chapter list, a centered draft, and optional chapter tools. Formatting is directly above the draft. The draft is capped at 660px and 65ch; the chapter title uses bundled Caveat under the SIL Open Font License. Times New Roman remains available in the manuscript font selector.

Mint charcoal is the default for a new workspace. Existing appearance preferences remain available. Newly typed characters get a 1.5-second mint glow; text stays visible. The animation is decorative, excluded from saved documents and exports, and disabled by reduced-motion preferences or the Typing glow switch.

Chapter tools include notes, outline, hints, ideas, and the optional Assistant. The Assistant retains its explicit text preview and Generate action. Both sidebars can be hidden independently; Focus mode hides both. The menu layout wraps for smaller screens.

## Build and verification

Run `python work/build_app.py` to regenerate the app and portable HTML from the source template and extensions. The portable file embeds the title font and license. Release package inventories include all new runtime and build assets.

Run `node --test tests/*.test.cjs` and `python -m unittest discover -s tests -p 'test_*.py'`. When Python is not available as `python3`, set `WRITING_DESK_TEST_PYTHON` to its executable. On Windows use UTF-8 mode for Python. The symlink backup test requires permission to create symbolic links.

The desktop and narrow-screen walkthrough covered navigation, text editing, formatting, persistence, export, animation preferences, and a simulated Assistant response. It does not establish real-user outcomes, screen-reader coverage, macOS behavior, or live AI provider behavior.
