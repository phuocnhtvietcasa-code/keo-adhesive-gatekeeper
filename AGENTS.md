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
- Login uses usernames mapped to `<username>@vietcasa.local` emails; public signup is disabled and only admin server functions create accounts, so the role check must stay server-side.
