# Changelog

This changelog was reconstructed from the complete GitHub history on
2026-07-16. Flashcardsish has no version tags, so its major changes are grouped
by month rather than by release number.

The review covered all 229 commits reachable from the remote repository: 125
source-history commits on `main`, 11 development or experimental commits, and
93 generated `gh-pages` deployment commits.

## July 2026 — Discovery, maintenance, and sync polish

- Added contextual tips that introduce useful features while you are already working
- Added controls for dismissing feature tips and resetting them from Settings
- Added safer data migration and merge helpers
- Added validation for shared-set links and snapshots
- Extracted raw-text importing into a more reliable parser
- Added PWA update detection and an in-app update flow
- Added regression tests for maintenance and migration behavior
- Added a dashboard for viewing cloud sync health and pending work
- Unified the sync dashboard layout across signed-in and signed-out states
- Cleaned up dependencies, service-worker behavior, and legacy storage paths

## June 2026 — Security and authentication hardening

- Hardened rich-text rendering against unsafe or malformed input
- Improved validation and normalization when reading stored card data
- Improved Firebase configuration handling
- Improved Google Drive request and authentication handling
- Added safer handling for browser-exposed Google configuration
- Updated the deployment workflow for hosted Google authentication
- Addressed security-scan findings in shared utility code

## April 2026 — Exam mode and offline mode

- Added a full Exam Mode
- Added Exam Mode configuration to the set study menu
- Added a dedicated offline runtime mode
- Isolated offline sets, folders, settings, tags, and progress from hosted data
- Added the `npm run dev:offline` development command
- Documented how to export offline data back into the hosted app
- Fixed Google Drive loading failures
- Fixed Google sign-in behavior across runtime modes
- Fixed an issue with set runs
- Added clearer feedback while data is loading
- Fixed SRS mastery triangle calculations and display

## March 2026 — SRS, sharing, onboarding, and reliable saving

- Added spaced repetition powered by the SM-2 scheduling algorithm
- Added a dedicated SRS setup screen
- Added a dedicated SRS study mode
- Added persistent SRS scheduling data to cards
- Added test-date cram behavior to SRS
- Added SRS maturity triangles
- Added progress dots to card previews
- Added support for shuffling SRS sessions
- Added Firebase-backed links for sharing sets
- Added a read-only view for opening shared sets
- Added a beta onboarding tour
- Added more prominent study cues in Flashcards Mode
- Reworked the formatting guide and supporting documentation
- Added a third-generation storage flow for more reliable local saving
- Improved cross-device loading from Google Drive
- Improved downloaded set files
- Added a manual force-Drive action for sync recovery
- Fixed saving after changes to global settings
- Fixed Learn Mode behavior when several sessions exist
- Added multiple-choice keyboard shortcuts
- Improved feedback when an answer is mixed up with another card
- Added stronger streak feedback and profile polish
- Polished the library and gameplay interfaces
- Removed the short-lived AI study feature and API-key setup

## February 2026 — Editing and customization

- Updated Google Drive exports
- Split user data into smaller files instead of one central data file
- Restored the floating formatting toolbar
- Improved highlight consistency
- Added support for highlighting over existing highlights
- Upgraded bullets into rich editable content
- Improved Tab key behavior in the visual editor
- Fixed the Raw Text editor layout on smaller screens
- Added tags at the set level
- Added local autosave while editing
- Added fully customizable keyboard shortcuts
- Added an in-app keyboard shortcut guide
- Added a keep-me-signed-in option
- Added drag-and-drop movement of custom fields between card sides
- Improved mobile Settings layouts
- Reorganized and clarified set configuration
- Added Slabs for structured card content
- Added more useful feedback when working with Slabs
- Added an in-app feedback form
- Added support for empty folders
- Added a favicon and app icon treatment
- Improved Multistudy behavior
- Improved navigation by making the app title consistently return home
- Added and expanded the project credits
- Expanded the Terms of Service and Privacy Policy

## January 2026 — Study modes and Google Drive migration

- Added a dedicated Flashcards Mode
- Added a user and profile menu
- Added the Raw Text set-building workflow
- Added Zen and Batch study behavior
- Migrated cloud storage from Supabase to Google Drive
- Added clearer assignment of custom fields to card sides
- Added alerts when an answer matches a different card
- Improved bullet formatting and editing
- Added security improvements to authentication and storage
- Expanded the in-app documentation
- Improved general study controls and ergonomics

## December 2025 — Sets, organization, and cloud sync

- Overhauled the set data model
- Added custom fields to cards
- Added rich-text highlights
- Added reusable pill tags
- Added folders for organizing sets
- Added stars for marking important cards
- Added Multistudy sessions across several sets
- Added the ability to apply tags during a study session
- Added tag data to set imports and exports
- Added support for downloading Multistudy sets
- Added accidental-override protection
- Improved the retype-on-mistake flow
- Restored underline formatting
- Improved image and definition layouts
- Improved download reliability
- Reduced lag during larger study sessions
- Improved general visual consistency and stability
- Added iOS-specific compatibility fixes
- Added cloud syncing backed by Supabase
- Added the first legal and privacy pages

## November 2025 — Initial application and deployment

- Created the React and Vite flashcard application
- Added the original set creation flow
- Added the original Learn Mode study flow
- Added study streaks and celebration effects
- Added the Settings interface
- Added the library and active-session menus
- Rebranded the project from Flashcard Trainer Pro to Flashcardsish
- Added data importing and improved imported-card presentation
- Added images to flashcards
- Added persistent image links to exported card data
- Improved keyboard navigation tooltips
- Improved menu headings and empty states
- Added the project README and license
- Added the custom domain configuration
- Added automated GitHub Pages deployment
