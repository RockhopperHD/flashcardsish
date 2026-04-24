![Powered by Vibes](https://img.shields.io/badge/Powered%20by-vibes-ff69b4) 

# **Flashcardsish**

Flashcardsish is a lightweight flashcards app where you can create, study, and share vocabulary sets. It supports year input, basic markdown, and a couple of other things.

The official Flashcardsish app is hosted for free at [flashcardsish.owenwhelan.com](http://flashcardsish.owenwhelan.com)

It's fully open source (you're on the GitHub page) and free to use, so you can make clones of it or download it.

## **Features**

Like other flashcards apps (notably the one that rhymes with *Bizlet*), Flashcardsish has a learn mode. This is straightforward: enter a list of terms and definitions and get drilling. However, it also has other quality of life changes:

* **Custom Fields:** Want another field for years, an author’s name, or something else? Add one or more custom fields to fine tune cards. This is great for learning titles and dates, associating authors with works, or categorizing something into a group.  
* **O to Override:** This is an intuitive keyboard shortcut that lets you move on from flashcards without picking up your mouse, letting you truly lock in.  
* **Folders:** Categorize sets.  
* **Multistudy:** Don’t want to merge sets, but want to study more than one at once? Use the multistudy feature to make a lump learn session to drill everything together.  
* **Cloud Sync:** You can sign into Google to sync your cards across devices, and your data isn’t collected for advertising\! Doing so is also completely free, and allows you to upload images.  
* **Download Sets:** Don’t want to sign into Google or need to send it to a friend? You can download sets as `.flashcards` files\* and send or keep them for your own use. You can also directly edit those in a text editor, or use the `.flashcards` format for your own program(s).  
* …and more\!

Flashcardsish is being actively updated, too\!

## **Open Source & Contributing**

You can absolutely download and clone this for your own use, including publishing your own versions and downloading it for local use (something I actually recommend\! see below). I just ask you don't monetize it and you credit me where due.

If you wish to contribute, please contact me ([owenw2023@gmail.com](mailto:owenw2023@gmail.com)) or make a request here on GitHub.

## **Offline-Only Local Mode**

If you want the full Flashcardsish experience on your own machine, use the dedicated offline-only mode:

1. Download or `gh repo clone RockhopperHD/flashcardsish`  
2. `cd flashcardsish`
3. `npm install`  
4. `npm run dev:offline`  
5. Open the local URL shown by Vite in your browser.

Offline-only mode keeps the normal Flashcardsish interface and study flow, but saves sets, folders, settings, tags, and progress locally under a separate offline storage namespace. When you want to move that progress back into the hosted app, use `Settings -> Global Settings -> Export Data`.

This is the recommended local path for most people. It does not require Google credentials and avoids the old local boot issues caused by cloud setup expectations.

Offline-only mode includes payload handoff for moving your local snapshot back into the hosted app:

1. In the offline build, click `Create Payload`.
2. Open the hosted app and go to the home screen.
3. Click the yellow `Payload` button next to `Feedback`.
4. Upload the `.flashcardsishpayload` file to merge your offline work into the hosted library.

Payload import is merge-first. Existing hosted sets stay in place, payload-only sets are added, and matching sets are merged without intentionally wiping unrelated content.

# **Credits**

[Owen Whelan](https://owenwhelan.com) did the whole vibe coding process for this. I started by using Google AI Studio but then shifted to Google Antigravity. I made Flashcardsish because I wanted something like it, but then published it to hopefully help other students.

I do not currently make money off this in any way. I doubt anyone’s going to try and impersonate me, but if you think someone is… check here first or email me\!

*This README was written by a human.*
