# Fix for Node.js 24 Compatibility Issue

## The Problem
Node.js 24 introduces a `node:sea` feature that Expo CLI tries to create a directory for, but Windows doesn't allow colons (`:`) in directory names.

## Solution 1: Clear Cache and Reinstall (Recommended)

1. Delete the `.expo` folder:
```powershell
Remove-Item -Recurse -Force .expo
```

2. Clear npm cache:
```powershell
npm cache clean --force
```

3. Delete node_modules and reinstall:
```powershell
Remove-Item -Recurse -Force node_modules
npm install
```

4. Try starting again:
```powershell
npm start
```

## Solution 2: Use Expo 51 (Already Updated)

The package.json has been updated to Expo 51 which has better Node.js 24 support. After reinstalling dependencies, it should work.

## Solution 3: Environment Variable Workaround

Set this environment variable before starting:
```powershell
$env:NODE_OPTIONS="--no-experimental-sea"
npm start
```

## Solution 4: Downgrade Node.js (Last Resort)

If nothing works, you can use Node.js 20 LTS instead:
1. Download Node.js 20 LTS from nodejs.org
2. Install it
3. Restart PowerShell
4. Run `npm install` and `npm start`

## Quick Fix Command

Run this in PowerShell:
```powershell
Remove-Item -Recurse -Force .expo -ErrorAction SilentlyContinue; npm cache clean --force; npm install; npm start
```

