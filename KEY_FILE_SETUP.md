# Optional local DeepSeek key file

The writing app works without an API key. A private key file is an optional way to reuse your own DeepSeek key with the writing assistant. The download includes **deepseek-key.example.json**, which is deliberately blank:

```json
{"apiKey": ""}
```

## Set up your private copy

1. Open Writing Studio with its Mac or Windows launcher, then open **Assistant → Assistant settings → Saved API key file**. Find the key-file path shown there.
2. Copy **deepseek-key.example.json** to that private location, naming your copy **deepseek-key.json**. Keep the example in the downloaded app folder blank. You can instead click **Create empty key file** to create the same blank file at the displayed path.
3. Edit the private copy in a plain text editor. Put your own DeepSeek key between the quotes after `apiKey`, keeping valid JSON, then save the file.
4. Select **Allow Writing Studio to read this key file**. If reading is already enabled after you edit the file, click **Reload saved key**. The app reads it locally and attaches the key; generating a suggestion is the action that contacts DeepSeek.

The default location is beside the backup folder, outside the downloaded app folder. Follow the path shown in the app, particularly if an older Writing Desk folder is being reused. File reading starts disabled and requires your choice. If you enable it, the app reads that key when the launcher starts again and before each generation. Read permission is stored in **deepseek-key-settings.json** beside your key file; it contains the permission setting rather than the key.

The file contains a plain text credential. Protect access to your computer and keep the private copy out of GitHub. The project ignores the default real key filename; the release packager includes only the blank example and rejects a filled example. A custom filename also needs to stay out of your repository. The key never belongs in a manuscript or project backup.

## Stop using or remove the saved key

**Disconnect** clears the in-memory key and disables automatic file reading. It leaves your private file in place.

**Remove saved key** atomically replaces the configured file with an empty key, disables reading, and forgets the in-memory key. You can instead edit the private file and change it back to `{"apiKey": ""}` yourself. Disconnect afterward to clear a key already held by the running launcher.

Manual **Attach key** remains available for a session and turns off automatic file reading. Closing the launcher clears that in-memory copy. Already sent requests may still be processed by the provider, and use of the assistant can incur charges on your DeepSeek account.
