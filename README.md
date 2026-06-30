# Modular & Secure API Engine Dashboard

This project features a refactored application following a clean **MVC (Model-View-Controller)** structure. The refactor successfully resolves previous Jinja2 rendering issues and implements security best practices to protect sensitive developer credentials.

---

## 📂 Project Folder Structure

The application is organized as follows to ensure separation of concerns and maintainability:

```text
ConstruccionEnAplicacionesDeDatos/
│
├── api.py                    # Flask Python controller and API endpoints
│
├── templates/
│   └── index.html            # Dashboard structure, linking static assets
│
└── static/
    ├── css/
    │   └── styles.css        # Custom CSS rules (scrollbars, transitions)
    └── js/
        └── app.js            # Core interactive logic (SVG graph, OAuth login, tabs, counters)

```
🔒 Implemented Security Masking & Token Protection
We have added robust client-side masking to prevent private developer keys and token values from being leaked in plaintext on the screen:

🔑 API Keys Masking in Tables
Truncated Layout: Token values generated inside the API Keys panel are now truncated and masked (e.g., ak_live_x8f2...9z0w).

Secure Copy: Added a copy icon (content_copy) next to the masked keys. Clicking it triggers copyToClipboard() to securely copy the full key.

📜 Secure Logging
Refactored the terminal log generator to automatically mask new tokens upon creation inside the live logs stream, printing only a masked string.

👁️ Documentation Console Password Visibility Toggle
The Authorization token input field on the Try It Out documentation tester was converted to a password field (type="password"), displaying token strings as secure bullets by default.

Added an interactive visibility button (eye icon visibility / visibility_off) inside the input container to easily toggle between revealing the plain text and hiding it.

🧪 Verification & Testing
1. Flask Controller Execution
The modular backend app was started successfully via python api.py. The controller compiles and serves requests on port 5000:

Bash
* Serving Flask app 'api'
 * Debug mode: on
 * Running on [http://127.0.0.1:5000](http://127.0.0.1:5000)
2. HTTP Route Verification
Tested the index endpoint / using curl.exe to verify successful HTML generation:

Bash
curl.exe -s -I [http://127.0.0.1:5000/](http://127.0.0.1:5000/)
Result: Confirmed HTTP/1.1 200 OK with a valid content length, proving that all Jinja2 template bindings are parsing correctly without any compilation errors.
