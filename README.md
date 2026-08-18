# Election Map Application

## Getting started
Follow these simple instructions to set up and run the application locally.

### Prerequisites
Ensure you have Node.js installed on your system.


# 1. Installation
Clone the repository and install the project dependencies:

```bash
npm install
```

# 2. Configure Environment Variables
You need to provide your MapTiler API key so the map can render correctly.

1. Create a file named `.env` in the root directory of your project.

2. Add your MapTiler API key using the following format:
```
VITE_MAPTILER_API_KEY=your_maptiler_api_key_here
```
(Note: If you plan to publish this application publicly, remember to configure HTTP Referrer restrictions and set a monthly spending limit inside your MapTiler Cloud Dashboard to protect your key from abuse.)


# 3. Run the Development Server
Start the local development server:

``` bash
npm run dev
```
Open the local URL provided in your terminal (usually http://localhost:5173) to view the interactive election map in your browser.