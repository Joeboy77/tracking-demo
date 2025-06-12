# Food Delivery Tracker

A real-time food delivery tracking application built with React, Node.js, Socket.io, and Leaflet GPS Control.

## Features

- 🍕 **Real-time delivery tracking** between customers and couriers
- 🗺️ **Interactive maps** with GPS location sharing
- 📱 **Mobile-responsive design** for both web and mobile
- 🚗 **Route simulation** for testing and demonstration
- 🔄 **Live updates** via WebSocket communication
- 📍 **GPS integration** using the Leaflet GPS Control plugin

## Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- A cloned copy of the `leaflet-gps` repository

### 1. Setup the Project
```bash
# Clone or create the project structure
mkdir food-delivery-tracker
cd food-delivery-tracker

# Create frontend with Vite
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install leaflet socket.io-client
cd ..

# Create backend
mkdir backend
cd backend
npm init -y
npm install express socket.io cors nodemon dotenv
cd ..
```

### 2. Copy GPS Control Files
From your cloned `leaflet-gps` repository, copy these files to `frontend/public/leaflet-gps/`:
- `dist/leaflet-gps.min.js`
- `dist/leaflet-gps.min.css`
- `images/gps-icon.png` (or the SVG version)

### 3. Replace the Default Files
Replace the generated files with the components provided above:
- Update `frontend/public/index.html`
- Replace `frontend/src/App.jsx`
- Create all the component files in their respective directories

### 4. Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### 5. Access the Application
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

## How to Use

### Customer View
1. Switch to "Customer View" using the toggle
2. Click the GPS button to share your location
3. Watch real-time courier location updates
4. Track delivery progress with the status indicators

### Courier View
1. Switch to "Courier View" using the toggle
2. Use "Start GPS Tracking" for real location sharing
3. Use "Simulate Route" for demo movement
4. Mark orders as delivered when complete

## Demo Features

- **Real GPS**: Uses your actual device location
- **Route Simulation**: Simulates courier movement for demo
- **Different Marker Styles**: Restaurant, customer, and courier markers
- **Mobile Responsive**: Works on both desktop and mobile
- **Professional UI**: Modern, clean interface with animations

## File Structure
```
food-delivery-tracker/
├── frontend/
│   ├── public/
│   │   ├── leaflet-gps/          # GPS control files
│   │   └── index.html            # Updated with dependencies
│   ├── src/
│   │   ├── components/
│   │   │   ├── CustomerView.jsx  # Customer tracking interface
│   │   │   ├── CourierView.jsx   # Courier delivery interface
│   │   │   └── MapComponent.jsx  # Reusable map component
│   │   ├── hooks/
│   │   │   └── useSocket.js      # Socket.io React hook
│   │   ├── styles/
│   │   │   └── App.css           # Professional styling
│   │   ├── App.jsx               # Main application
│   │   └── main.jsx              # React entry point
│   └── package.json
└── backend/
    ├── server.js                 # Express + Socket.io server
    └── package.json
```

## Technologies Used

- **Frontend**: React 18, Vite, Leaflet, Socket.io Client
- **Backend**: Node.js, Express, Socket.io
- **Maps**: OpenStreetMap, Leaflet GPS Control
- **Styling**: CSS3, Flexbox, Grid, Professional animations
- **Real-time**: WebSocket communication

## Next Steps

After getting this working, you can extend it with:
- User authentication
- Order management system
- Push notifications
- Offline mode support
- Database integration
- Payment processing
- Analytics dashboard

## Troubleshooting

1. **GPS not working**: Ensure you're using HTTPS or localhost
2. **Connection issues**: Check that both servers are running
3. **Map not loading**: Verify Leaflet files are properly copied
4. **Socket errors**: Check CORS settings in backend

Enjoy building your real-time food delivery tracker! 🚀