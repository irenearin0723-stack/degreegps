# Is my DegreeGPS GitHub repository private?

**Do not infer repo privacy from local files.** `package.json`'s `"private": true` is an npm setting, not a GitHub visibility setting.

## To create a private repo

1. Sign into GitHub and open https://github.com/new.
2. Repository name: `degreegps`.
3. Under **Choose visibility**, select **Private**.
4. If pushing this starter with Git, do not auto-add a README, `.gitignore`, or license in the empty remote repo.
5. Click **Create repository** and push the local starter. The header of the newly created repo should show a **Private** badge beside its name.

## To check an existing repo

1. Visit its **exact URL** while logged in.
2. Look for the **Private** badge near the repository title.
3. If it says **Public**, open **Settings → General → Danger Zone → Change repository visibility**, select private, and follow the confirmation prompts. This requires repo admin permissions.
4. If you cannot see the repo, a 404 page does **not** prove it is private: it may not exist, or you may not have access.

## Inviting teammates

In your private repo: **Settings → Collaborators and teams** (or **Collaborators**) → **Add people**. Invite their GitHub usernames; they must accept before they can access the repo. Avoid making the repo Public solely for team collaboration.

**Safety:** Do not commit `.env` credentials, tokens, API keys, or private university/student data to the repository, even if it is private.
