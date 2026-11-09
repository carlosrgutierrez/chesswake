#!/usr/bin/env node
import { defaultSettingsFile, listAlarms, setAlarm } from './alarm-store.mjs';

const [command, ...args] = process.argv.slice(2);
const option = name => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

try {
  if (command === 'set') {
    const alarm = setAlarm(defaultSettingsFile(), { time: option('--time'), label: option('--label') });
    console.log(`Saved daily alarm: ${alarm.time} (${alarm.label}).`);
    console.log('Launch or restart ChessWake, then use Test Alarm to check sound. Keep the Mac awake and the app running.');
  } else if (command === 'list') {
    const alarms = listAlarms();
    if (!alarms.length) console.log('No saved alarms.');
    for (const alarm of alarms) console.log(`${alarm.time}\t${alarm.enabled ? 'enabled' : 'disabled'}\t${alarm.label}`);
  } else {
    throw new Error('Use `npm run alarm:set -- --time 04:00 [--label Morning]` or `npm run alarm:list`.');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
