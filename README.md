# image-annotator
A simple querystring-driven, zero-backend, sessionless image annotation tool. All data is directly in the URL query string. Perfect for quick feedback loops without the overhead of creating accounts or managing databases.

## 🚀 The Concept
Most collaboration tools force you to create an account to save your work. **image-annotator** takes a different approach: it encodes your coordinates and notes into the URL itself. If you have the link, you have the data.

1. **Paste** an image URL.
2. **Click** to add notes.
3. **Save** to update the URL with your data.
4. **Share** the resulting link; the recipient sees exactly what you created.

## ✨ Features
* **Zero Personal Info:** No sign-up, no "Guest" accounts, no tracking.
* **Smart URL State:** The app auto-populates from the query string on load.
* **Live Editing:** Add, drag, or delete pins with a simple CRUD interface.
* **Unsaved Changes Indicator:** A visual cue lets you know when your current pins don't match the URL in the address bar.
* **Responsive Accuracy:** Coordinates are stored as percentages ($X\%, Y\%$), ensuring pins stay perfectly aligned regardless of the viewer's screen size.
* **One-Click Sharing:** A "Copy Link" button instantly grabs the data-heavy URL for sharing via Slack, Email, or Jira.

## 🔗 URL Schema
The app parses two primary parameters:
* `i`: The URL-encoded source of the base image.
* `d`: A compressed or Base64-encoded JSON array of annotations.
  
**Example Data Structure:**
```json
[
    { "x": 45.5, "y": 20.1, "note": "Fix this alignment" },
    { "x": 10.2, "y": 88.0, "note": "Update logo" }
]
```

## 🛠 Technical Implementation
* **Language:** Vanilla JavaScript (ES6+).
* **Persistence:** `window.history.pushState` updates the address bar without page reloads.
* **Encoding:** Uses `encodeURIComponent` for image URLs and `LZ-String` (optional) for JSON compression to stay within the ~2,000 character "safe" URL limit.
* **Hosting:** Optimized for **GitHub Pages** (Static site, no server-side processing required).

## 💡 How to Use
1. **Load an Image:** Paste a direct link to any public image (`.jpg`, `.png`, `.webp`).
2. **Annotate:** Click anywhere on the image to drop a pin. Type your note in the sidebar or popup.
3. **Update:** Click the "Save/Update URL" button.
4. **Collaborate:** Copy the browser URL and send it to your team.

## ⚖️ Privacy & Security
* **No Server:** Your data never touches a server.
* **CORS Aware:** Images are rendered via standard `<img>` tags.
* **Open Source:** Review the code, fork it, or host your own version on GitHub Pages.

## 🛠 Local Development
1. Clone the repo:
   `git clone https://github.com/koryp/image-annotator.git`
2. Code

[https://github.com/koryp/image-annotator.git](https://github.com/koryp/image-annotator.git)

---
*Built for developers and designers who just want to point at things without filling out a sign-up form.*