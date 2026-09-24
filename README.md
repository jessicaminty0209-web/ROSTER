# TSB Roster⭐️

A mobile-first static PWA prototype for turning The Star roster screenshots into a colour-coded calendar.

## How it works
1. Tap "Add roster screenshots".
2. Select one or more roster screenshots.
3. OCR runs in the browser using Tesseract.js.
4. The app extracts roster dates and start times.
5. Each shift is treated as 8 hours.
6. Shift cards are colour-coded by start time:
   - 06:00–10:00 #F7EFE2
   - 12:00–14:00 #DDCDBD
   - 16:00–17:00 #E5EDF0
   - 18:00–19:00 #9FADB6
   - 20:00–22:00 #A49284
7. Shifts are stored locally on the device.
8. "Export to Apple Calendar" creates an .ics calendar file.

## Note about the 16:00 colour
The supplied value "E5EDFO" contains the letter O, so it is not a valid hex colour. This prototype uses `#E5EDF0`, which matches the pale blue in the reference theme.

## iPhone widget
This version is installable as a Home Screen web app (PWA), but a true native iOS Home Screen widget cannot be created by GitHub Pages/PWA alone. A native iOS wrapper and WidgetKit target would be needed for the real widget. The app's data model is kept simple so that a native widget can be added later.

## Hosting
The project can be hosted on GitHub Pages or another static host. Tesseract.js is loaded from jsDelivr, so OCR requires internet access.
