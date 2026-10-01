import type { Msg } from '../types'

/** Scheduling unsaved page edits, and what the scheduler reports afterwards. */
export default {
  title: 'Schedule these changes',
  introOne: 'The edits on {page} are set aside. The site stays as it is until the time you pick.',
  introMany: {
    one: 'The edits on {count} page ({pages}) are set aside. The site stays as it is until the time you pick.',
    other:
      'The edits on {count} pages ({pages}) are set aside. The site stays as it is until the time you pick.'
  } satisfies Msg,
  name: 'Name',
  nameHint: 'Shown in Publish and in notifications.',
  namePlaceholder: 'e.g. Spring sale launch',
  goesLive: 'Goes live',
  zoneHint: 'In your computer’s time zone ({zone}).',
  takeDown: 'Take the changes down again later',
  comesDown: 'Comes down',
  comesDownHint: 'The pages go back to how they are now.',
  deploy: 'Deploy to production when it goes live',
  deployBoth: 'Deploy to production when it goes live and when it comes down',
  noDeploy:
    'To deploy automatically, set up publishing in Project settings. Without it, the pages change in the folder and you publish them yourself.',
  backgroundMac:
    'CraftPages does this on this computer and keeps running in the menu bar when you close the window. If the computer is asleep or off at that time, the changes go out as soon as it’s back.',
  backgroundOther:
    'CraftPages does this on this computer and keeps running in the system tray when you close the window. If the computer is asleep or off at that time, the changes go out as soon as it’s back.',
  submit: 'Schedule',
  submitting: 'Scheduling…',

  runPosts: 'Now on the site: {items}.',
  runReleased: 'Scheduled changes are live: {items}.',
  runEnded: 'Taken down as scheduled: {items}.',
  runBlocked: 'Held back because the page changed in the same place: {items}. See Publish.',
  runDeployed: 'Deployed to production.',
  runPublishHint: 'Publish the site to put it online.'
} satisfies Record<string, Msg>
