# Luke Dickinson — site

Plain HTML/CSS/JS, no build step. Preview it locally with:

```bash
python3 -m http.server 5173
```

Most things you'd change live in `config.js`: hours, services, prices, contact info, payment,
gallery photos, reviews, semesters and class times.

Until bookings are connected (next section), the booking form shows **"Online booking opens soon"**
and won't accept bookings, so nobody thinks they're booked when Luke never heard about it.

## Launch checklist

1. Set up the calendar script (next section) and paste its URL into `calendarScriptUrl`.
2. In `apps-script/Code.gs`, fill in `LOCATION` (his real address). Keep it out of GitHub: paste it
   only into the copy in the Apps Script editor, not this file.
3. In `config.js`, fill in `instagram` and `workingHours`.
4. Change the admin password (see "Admin" below).
5. Put the site online (see "Going live").
6. Before January 11: enter the spring classes in the admin panel (**Classes** tab).

## Bookings → Google Calendar, invites and reminders

`apps-script/Code.gs` is a small free script that runs on **Luke's** Google account. Once it's set up:

- Each booking goes straight onto Luke's Google Calendar.
- The client is added as a guest, so Google emails them a calendar invite right away, with the address.
  Gmail users see it appear in their Google Calendar on its own; Apple and Outlook users get a
  standard invite they can accept.
- About a day before the cut, the client gets a reminder email with the address, payment and a
  "text Luke to reschedule" line.
- Luke gets an email with the client's phone and notes.
- Anything on Luke's calendar (other bookings, work shifts, plans) is hidden from the site, so
  two people can't book the same time.

**The address stays private.** The public site only says "Address provided upon booking". The real
address is in the script, which only Luke can see, and it goes out only in the invite and reminder.

Setup (Luke does this, signed in to his Google account, about 10 minutes):

1. Go to https://script.google.com and click **New project**. Name it "Bookings".
2. Delete the starter code, paste in everything from `apps-script/Code.gs`.
   At the top, fill in `LOCATION` with his address (only in the editor, not in the GitHub copy). Click **Save**.
3. Open **Project Settings** (gear icon) and check that **Time zone** is Eastern Time
   (West Lafayette).
4. Click **Deploy → New deployment**. For type, pick **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Click **Deploy**, then **Authorize access**. Google will warn that the app isn't verified,
   because Luke wrote it himself. Click **Advanced → Go to Bookings** and allow access.
6. Copy the **Web app URL** (ends in `/exec`) and paste it into `config.js`:
   ```js
   calendarScriptUrl: "https://script.google.com/macros/s/AKfy.../exec",
   ```
7. **Set the admin password:** click **Project Settings** (gear icon), scroll to **Script Properties**,
   click **Add script property**, and add `ADMIN_PASSWORD` with the password as the value. It's kept
   there instead of in the code, so it isn't visible on GitHub.
8. **Turn on reminders:** back in the script editor, pick `installReminders` in the function
   dropdown at the top and click **Run** (allow access if asked). This only needs doing once.
9. Make a test booking with your own email, at least a day out, and check that the invite arrives.

If you edit `Code.gs` later: **Deploy → Manage deployments → Edit → Version: New version**.
That keeps the same URL.

Gmail note: Google auto-adds invites unless the client changed the Google Calendar setting
"Add invitations to my calendar" to "only if the sender is known". In that case they click
**Yes** in the email instead.

## Admin (hidden)

At the very bottom-right of the page is a tiny, faint dot. Clicking it asks for the admin password
(currently `dickinson`), every time.

- **Time off:** block whole days or part of a day ("busy 4–9pm Friday") across a date range,
  with a private note, and remove it later.
- **Classes:** the class schedule for each semester. Fall 2026 ends **Dec 18**, and Spring 2027
  starts **Jan 11**. Winter break in between has no classes, so those days are open within his hours.
  He can block off break days in **Time off** if he's going home.
  **Spring is "not entered yet", so Jan 11 onward is closed for booking** until Luke adds his
  spring classes (or picks "No classes this semester") and clicks **Save schedule**.
  "+ New semester" adds the next one when it comes.

With the calendar script connected, everything saved here applies for every visitor. Time off
becomes "Unavailable" events on his Google Calendar, and the class schedule is stored in the script.
Without it, changes only apply in the browser they were made in (fine for previewing).

**Change the password** before launch, since "dickinson" is easy to guess:
1. In the Apps Script editor, change the `ADMIN_PASSWORD` script property (Project Settings → Script
   Properties). No redeploy needed.
2. In `config.js`, replace `adminPasswordHash` with the output of:
   ```bash
   printf %s 'your-new-password' | shasum -a 256
   ```

## Photos and reviews

- **More photos:** drop the file in `assets/` and add a line to `gallery` in `config.js`:
  `{ src: "assets/new-cut.webp", caption: "Mid taper · curls" }`. Portrait photos (taller than wide)
  look best. The gallery's scroll length adjusts on its own.
- **Reviews:** add real quotes to `reviews` in `config.js`. The Reviews section stays hidden until
  there's at least one.

## Going live

Free options: **Netlify** (drag the project folder onto https://app.netlify.com/drop),
**Cloudflare Pages**, or **GitHub Pages**. A custom domain (about $12/yr) can be added in any of them.

After it's live:
1. Set `siteUrl` in `config.js`.
2. In `index.html`, change `og:image` to the full URL (`https://yourdomain.com/assets/og-image.jpg`).
   That makes the photo preview show up when the link is texted or put in his Instagram bio.
3. After changing any file, bump the `?v=10` numbers at the bottom of `index.html` so visitors' browsers
   load the new version.

## Fallback: Formspree (emails Luke only, no client invite)

If `calendarScriptUrl` is blank but `bookingEndpoint` is set, bookings go through Formspree instead:

1. Sign up at https://formspree.io with the email Luke wants bookings sent to.
2. Click **New Form** and copy the URL (`https://formspree.io/f/abcdwxyz`).
3. Paste it into `bookingEndpoint` in `config.js`.

With Formspree, clients see "Add to Google Calendar" and "Apple / Outlook" buttons after booking
instead of getting an invite, there are no reminders, and the site can't see other clients' bookings.
