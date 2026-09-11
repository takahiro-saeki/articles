expected_account=takahiro-saeki
expected_remote=https://github.com/takahiro-saeki/articles.git
actual_account=$(gh api user --jq .login) || exit 1
[ "$actual_account" = "$expected_account" ] || exit 1
actual_remote=$(git remote get-url --push origin) || exit 1
[ "$actual_remote" = "$expected_remote" ] || exit 1
printf '%s\n' 'identity and destination verified'
