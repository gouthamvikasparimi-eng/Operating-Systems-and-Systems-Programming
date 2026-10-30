# Linux System Information and Resource Monitoring Tool

A responsive browser-based demonstration dashboard built with **HTML, CSS and JavaScript**. It presents the key areas described in the project abstract and presentation: CPU utilization, memory usage, disk usage, system uptime, process information and Linux system details.

## Project files

- `index.html` — page structure and dashboard sections
- `style.css` — responsive layout, styling and charts
- `script.js` — demo monitoring values, charts, process search and auto-refresh

## Run the website

1. Download and extract `Linux_Resource_Monitor_Website.zip`.
2. Open the extracted folder.
3. Double-click `index.html`, or open it in a browser.
4. Use the left navigation to move between Overview, CPU Monitor, Memory, Disk Usage, Processes and System Info.

No installation or build step is required.

## Features

- Dashboard cards for CPU, RAM, disk and uptime
- Auto-refreshing demo resource values every five seconds
- CPU and memory activity charts drawn with the HTML Canvas API
- Process table with search
- System specification summary
- Responsive desktop and mobile layout

## Important implementation note

This is a **front-end demonstration**. A normal browser page cannot read Linux kernel files such as `/proc/stat`, `/proc/meminfo`, `/proc/uptime` or `/proc/[pid]` directly. Therefore, the displayed resource and process values are sample/demo data and must not be treated as actual machine measurements.

To turn this into the complete Linux system programming project, implement a C backend on Ubuntu that reads the relevant `/proc` files and uses suitable Linux/POSIX APIs or system calls. Expose the collected data to the web interface through a local service/API, then replace the sample values in `script.js` with API responses. Disk information can be collected using suitable filesystem APIs (for example, `statvfs`).

## Technologies

- HTML5
- CSS3
- JavaScript (ES6)
- Canvas API for charts

## Project alignment

The sections and monitoring categories follow the uploaded project material for **Linux System Information and Resource Monitoring Tool**. The source project describes a Linux C/C++ application using Ubuntu, GCC, Linux/POSIX APIs, system calls and the `/proc` filesystem; this website is a visual front-end prototype for that concept.
