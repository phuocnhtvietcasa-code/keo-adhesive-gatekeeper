<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- The warehouse app is the user's original HTML kept unchanged at public/kho-app.html, shown in an iframe on /kho; never edit it — wrap features around it instead.

- Login goes through the signInWithUsername server fn: username -> profiles.email (real recovery email, else username@vietcasa.local) resolved server-side so emails never reach the browser; setting an email also updates the auth email so password-reset mail can be delivered.
