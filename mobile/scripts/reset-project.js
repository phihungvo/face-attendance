#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const root = process.cwd();
const sourceDirs = [
  'src/app',
  'src/components',
  'src/config',
  'src/constants',
  'src/features',
  'src/hooks',
  'src/services',
  'src/shared',
];
const exampleDir = 'app-example';
const newAppDir = 'src/app';
const exampleDirPath = path.join(root, exampleDir);

const indexContent = `import { Text, View } from 'react-native';

export default function Index() {
  return (
    <View
      style={{
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
      }}>
      <Text>Edit src/app/index.tsx to edit this screen.</Text>
    </View>
  );
}
`;

const layoutContent = `import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack />;
}
`;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function resetProject(shouldKeepExample) {
  try {
    if (shouldKeepExample) {
      await fs.promises.mkdir(exampleDirPath, { recursive: true });
      console.log(`/${exampleDir} directory created.`);
    }

    for (const dir of sourceDirs) {
      const sourcePath = path.join(root, dir);
      if (!fs.existsSync(sourcePath)) {
        console.log(`/${dir} does not exist, skipping.`);
        continue;
      }

      if (shouldKeepExample) {
        const targetPath = path.join(root, exampleDir, dir);
        await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.promises.rename(sourcePath, targetPath);
        console.log(`/${dir} moved to /${exampleDir}/${dir}.`);
      } else {
        await fs.promises.rm(sourcePath, { recursive: true, force: true });
        console.log(`/${dir} deleted.`);
      }
    }

    const newAppDirPath = path.join(root, newAppDir);
    await fs.promises.mkdir(newAppDirPath, { recursive: true });
    await fs.promises.writeFile(path.join(newAppDirPath, 'index.tsx'), indexContent);
    await fs.promises.writeFile(path.join(newAppDirPath, '_layout.tsx'), layoutContent);

    console.log('Project reset complete.');
    console.log('Next steps:');
    console.log('1. Run `npx expo start`.');
    console.log('2. Edit src/app/index.tsx.');
  } catch (error) {
    console.error(`Error during reset: ${error.message}`);
  }
}

rl.question('Move existing src files to /app-example instead of deleting them? (Y/n): ', (answer) => {
  const normalizedAnswer = answer.trim().toLowerCase() || 'y';

  if (normalizedAnswer !== 'y' && normalizedAnswer !== 'n') {
    console.log("Invalid input. Please enter 'Y' or 'N'.");
    rl.close();
    return;
  }

  resetProject(normalizedAnswer === 'y').finally(() => rl.close());
});
