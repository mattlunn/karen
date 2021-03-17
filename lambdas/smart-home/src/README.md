# Deploy

1. Run `npm run build` inside `lambdas/smart-home/src`, to build the `dist` directory.
2. In VS Code -> AWS Explorer -> Europe (Ireland) -> right click on the Lambda, and click "Upload Lambda"
3. Choose Directory, select dist folder, click "No" when prompted to build.

# Test

1. In VS Code -> AWS Explorer -> Europe (Ireland) -> right click on the Lambda, and click "Invoke on AWS"
2. Choose file within the "test" directory, then click Invoke