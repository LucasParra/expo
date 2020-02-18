import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import { Command } from '@expo/commander';
import spawnAsync from '@expo/spawn-async';

import { EXPO_DIR, ANDROID_DIR } from '../Constants';
import { getNextSDKVersionAsync } from '../ProjectVersions';
import { getReactNativeSubmoduleDir } from '../Directories';

type ActionOptions = {
  checkout?: string;
  sdkVersion?: string;
};

const REACT_NATIVE_SUBMODULE_PATH = getReactNativeSubmoduleDir();
const REACT_ANDROID_PATH = path.join(ANDROID_DIR, 'ReactAndroid');
const REACT_COMMON_PATH = path.join(ANDROID_DIR, 'ReactCommon');

async function checkoutReactNativeSubmoduleAsync(checkoutRef: string): Promise<void> {
  await spawnAsync('git', ['fetch'], {
    cwd: REACT_NATIVE_SUBMODULE_PATH,
  });
  await spawnAsync('git', ['checkout', checkoutRef], {
    cwd: REACT_NATIVE_SUBMODULE_PATH,
  });
}

async function updateReactAndroidAsync(sdkVersion: string): Promise<void> {
  console.log(`Cleaning ${chalk.magenta(path.relative(EXPO_DIR, REACT_ANDROID_PATH))}...`);
  await fs.remove(REACT_ANDROID_PATH);

  console.log(`Cleaning ${chalk.magenta(path.relative(EXPO_DIR, REACT_COMMON_PATH))}...`);
  await fs.remove(REACT_COMMON_PATH);

  console.log(`Running ${chalk.blue('ReactAndroidCodeTransformer')} with ${chalk.yellow(`./gradlew :tools:execute --args ${sdkVersion}`)} command...`);
  await spawnAsync('./gradlew', [':tools:execute', '--args', sdkVersion], {
    cwd: ANDROID_DIR,
    stdio: 'inherit',
  });
}

async function action(options: ActionOptions) {
  if (options.checkout) {
    console.log(`Checking out ${chalk.magenta(path.relative(EXPO_DIR, REACT_NATIVE_SUBMODULE_PATH))} submodule at ${chalk.blue(options.checkout)} ref...`);
    await checkoutReactNativeSubmoduleAsync(options.checkout);
  }

  // When we're updating React Native, we mostly want it to be for the next SDK that isn't versioned yet.
  const androidSdkVersion = options.sdkVersion || await getNextSDKVersionAsync('android');

  if (!androidSdkVersion) {
    throw new Error('Cannot obtain next SDK version. Try to run with --sdkVersion <sdkVersion> flag.')
  }

  console.log(`Updating ${chalk.green('ReactAndroid')} for SDK ${chalk.cyan(androidSdkVersion)} ...`);
  await updateReactAndroidAsync(androidSdkVersion);
}

export default (program: Command) => {
  program
    .command('update-react-native')
    .alias('update-rn', 'urn')
    .description('Updates React Native submodule and applies Expo-specific code transformations on ReactAndroid and ReactCommon folders.')
    .option('-c, --checkout [string]', 'Git\'s ref to the commit, tag or branch on which the React Native submodule should be checkouted.')
    .option('-s, --sdkVersion [string]', 'SDK version for which the forked React Native will be used. Defaults to the newest SDK version increased by a major update.')
    .asyncAction(action);
};
