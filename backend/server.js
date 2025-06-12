import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Vite default port
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));
app.use(express.json());

// Accra delivery area boundaries
const ACCRA_BOUNDS = {
  north: 5.8000,   // Northern limit of Greater Accra
  south: 5.3000,   // Southern limit
  east: 0.1000,    // Eastern limit
  west: -0.4000    // Western limit
};

// Function to check if coordinates are within Accra
const isWithinAccra = (lat, lng) => {
  return (
    lat >= ACCRA_BOUNDS.south &&
    lat <= ACCRA_BOUNDS.north &&
    lng >= ACCRA_BOUNDS.west &&
    lng <= ACCRA_BOUNDS.east
  );
};

// Function to validate delivery location
const validateDeliveryLocation = (location) => {
  if (!location || !location.coordinates) {
    return { valid: false, reason: 'Invalid location data' };
  }

  const [lat, lng] = location.coordinates;
  
  if (!isWithinAccra(lat, lng)) {
    return { 
      valid: false, 
      reason: 'Location is outside Accra delivery area',
      bounds: ACCRA_BOUNDS
    };
  }

  return { valid: true, reason: 'Location is within Accra delivery area' };
};

// In-memory storage for demo (use database in production)
let orders = {};
let courierLocations = {};
let customerLocations = {};
let activeConnections = new Map();

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);
  activeConnections.set(socket.id, { 
    connectedAt: new Date(),
    userType: null
  });

  // Customer joins order tracking
  socket.on('track-order', (orderId) => {
    socket.join(`order-${orderId}`);
    console.log(`👤 Customer tracking order: ${orderId}`);
    
    activeConnections.set(socket.id, {
      ...activeConnections.get(socket.id),
      userType: 'customer',
      orderId: orderId
    });
    
    // Send current courier location if available
    if (courierLocations[orderId]) {
      socket.emit('courier-location-update', {
        ...courierLocations[orderId],
        timestamp: new Date().toISOString()
      });
      console.log(`📍 Sent existing courier location for order ${orderId}`);
    }

    // Send current customer location to any couriers
    if (customerLocations[orderId]) {
      socket.to(`courier-${orderId}`).emit('customer-location-update', {
        orderId,
        customerLocation: customerLocations[orderId],
        timestamp: new Date().toISOString()
      });
    }
  });

  // Handle customer location updates with Accra validation
  socket.on('customer-location-update', (data) => {
    const { orderId, customerLocation } = data;
    
    if (!orderId || !customerLocation) {
      console.error('❌ Invalid customer location data:', data);
      socket.emit('location-error', { 
        message: 'Invalid location data provided',
        orderId 
      });
      return;
    }
    
    // Validate location is within Accra
    const validation = validateDeliveryLocation(customerLocation);
    if (!validation.valid) {
      console.log(`🚫 Location outside Accra for order ${orderId}:`, validation.reason);
      socket.emit('location-error', { 
        message: '⚠️ Sorry, we only deliver within Accra, Ghana',
        reason: validation.reason,
        bounds: validation.bounds,
        orderId 
      });
      return;
    }
    
    // Store customer location
    customerLocations[orderId] = {
      ...customerLocation,
      timestamp: new Date().toISOString(),
      socketId: socket.id,
      validated: true,
      validationTime: new Date().toISOString()
    };

    // Broadcast to couriers handling this order
    socket.to(`courier-${orderId}`).emit('customer-location-update', {
      orderId,
      customerLocation: customerLocations[orderId],
      timestamp: new Date().toISOString()
    });
    
    console.log(`🏠 ✅ Valid Accra location set for order ${orderId}:`, {
      address: customerLocation.address,
      coordinates: customerLocation.coordinates
    });

    // Update order data if exists
    if (orders[orderId]) {
      orders[orderId].deliveryAddress = customerLocation.address;
      orders[orderId].deliveryCoordinates = customerLocation.coordinates;
      orders[orderId].locationValidated = true;
    }

    // Send confirmation back to customer
    socket.emit('location-confirmed', {
      orderId,
      location: customerLocation,
      message: '✅ Delivery location confirmed within Accra'
    });
  });

  // Courier shares location
  socket.on('courier-location-update', (data) => {
    const { orderId, location, status } = data;
    
    if (!orderId || !location) {
      console.error('❌ Invalid courier location data:', data);
      return;
    }
    
    // Store latest location with timestamp
    courierLocations[orderId] = {
      location,
      status: status || 'on-the-way',
      timestamp: new Date().toISOString(),
      orderId,
      socketId: socket.id
    };

    // Broadcast to customers tracking this order
    const updateData = {
      location,
      status: status || 'on-the-way',
      timestamp: new Date().toISOString(),
      orderId
    };

    socket.to(`order-${orderId}`).emit('courier-location-update', updateData);
    
    // Check if courier is approaching Accra area
    const isInAccra = isWithinAccra(location.lat, location.lng);
    console.log(`🚗 Courier location updated for order ${orderId}:`, {
      lat: location.lat.toFixed(4),
      lng: location.lng.toFixed(4),
      status,
      inAccra: isInAccra
    });
  });

  // Courier joins delivery
  socket.on('start-delivery', (orderId) => {
    socket.join(`courier-${orderId}`);
    console.log(`🛵 Courier started delivery for order: ${orderId}`);
    
    activeConnections.set(socket.id, {
      ...activeConnections.get(socket.id),
      userType: 'courier',
      orderId: orderId
    });
    
    // Initialize order status if not exists
    if (!courierLocations[orderId]) {
      courierLocations[orderId] = {
        orderId,
        status: 'picked-up',
        timestamp: new Date().toISOString(),
        socketId: socket.id
      };
    }

    // Send current customer location to courier
    if (customerLocations[orderId]) {
      socket.emit('customer-location-update', {
        orderId,
        customerLocation: customerLocations[orderId],
        timestamp: new Date().toISOString()
      });
      console.log(`🏠 Sent validated Accra location to courier for order ${orderId}`);
    }
  });

  // Handle order status updates
  socket.on('update-order-status', (data) => {
    const { orderId, status } = data;
    console.log(`📦 Order ${orderId} status updated to: ${status}`);
    
    if (courierLocations[orderId]) {
      courierLocations[orderId].status = status;
      courierLocations[orderId].timestamp = new Date().toISOString();
    }
    
    // Broadcast status update to customers
    socket.to(`order-${orderId}`).emit('order-status-update', {
      orderId,
      status,
      timestamp: new Date().toISOString()
    });
  });

  // Handle ping/pong for connection health
  socket.on('ping', () => {
    socket.emit('pong');
  });

  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
    const connection = activeConnections.get(socket.id);
    
    if (connection) {
      console.log(`👋 ${connection.userType || 'Unknown user'} disconnected from order ${connection.orderId || 'unknown'}`);
    }
    
    activeConnections.delete(socket.id);
    
    // Clean up courier locations for this socket
    Object.keys(courierLocations).forEach(orderId => {
      if (courierLocations[orderId].socketId === socket.id) {
        console.log(`🧹 Cleaning up courier location data for order ${orderId}`);
        courierLocations[orderId].status = 'offline';
        courierLocations[orderId].timestamp = new Date().toISOString();
      }
    });
  });
});

// REST API endpoints

// Health check with Accra info
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    activeConnections: activeConnections.size,
    activeOrders: Object.keys(courierLocations).length,
    customerLocations: Object.keys(customerLocations).length,
    deliveryArea: 'Accra, Ghana',
    bounds: ACCRA_BOUNDS
  });
});

// NEW: Validate if coordinates are within Accra
app.post('/api/validate-location', (req, res) => {
  const { lat, lng, address } = req.body;
  
  if (!lat || !lng) {
    return res.status(400).json({
      valid: false,
      message: 'Latitude and longitude are required'
    });
  }

  const isValid = isWithinAccra(parseFloat(lat), parseFloat(lng));
  
  res.json({
    valid: isValid,
    location: { lat: parseFloat(lat), lng: parseFloat(lng), address },
    bounds: ACCRA_BOUNDS,
    message: isValid ? 
      '✅ Location is within Accra delivery area' : 
      '⚠️ Location is outside Accra delivery area'
  });
});

// Get Accra delivery boundaries
app.get('/api/delivery-area', (req, res) => {
  res.json({
    area: 'Accra, Ghana',
    bounds: ACCRA_BOUNDS,
    coverage: 'Greater Accra Metropolitan Area',
    popularLocations: [
      { name: 'East Legon', coordinates: [5.6037, -0.1870] },
      { name: 'Parliament House', coordinates: [5.5500, -0.2167] },
      { name: 'Osu', coordinates: [5.5563, -0.1969] },
      { name: 'University of Ghana', coordinates: [5.6519, -0.1861] },
      { name: 'Kotoka Airport', coordinates: [5.5697, -0.2318] },
      { name: 'Labadi Beach', coordinates: [5.5336, -0.2058] }
    ]
  });
});

app.get('/api/orders/:orderId', (req, res) => {
  const { orderId } = req.params;
  const courierLocation = courierLocations[orderId];
  const customerLocation = customerLocations[orderId];
  
  res.json({
    orderId,
    status: courierLocation?.status || 'preparing',
    courierLocation: courierLocation?.location || null,
    customerLocation: customerLocation || null,
    lastCourierUpdate: courierLocation?.timestamp || null,
    lastCustomerUpdate: customerLocation?.timestamp || null,
    locationValidated: customerLocation?.validated || false,
    found: !!(courierLocation || customerLocation),
    deliveryArea: 'Accra, Ghana'
  });
});

// Enhanced order creation with Accra validation
app.post('/api/orders', (req, res) => {
  const { 
    customerId, 
    restaurantLocation, 
    deliveryAddress, 
    deliveryCoordinates,
    customerPhone 
  } = req.body;
  
  // Validate delivery coordinates if provided
  if (deliveryCoordinates) {
    const [lat, lng] = deliveryCoordinates;
    if (!isWithinAccra(lat, lng)) {
      return res.status(400).json({
        error: 'Invalid delivery location',
        message: 'We only deliver within Accra, Ghana',
        bounds: ACCRA_BOUNDS
      });
    }
  }
  
  const orderId = `order-${Date.now()}`;
  
  orders[orderId] = {
    orderId,
    customerId,
    restaurantLocation,
    deliveryAddress: deliveryAddress || 'Address not set',
    deliveryCoordinates: deliveryCoordinates || null,
    customerPhone: customerPhone || '+233 24 123 4567',
    status: 'preparing',
    deliveryArea: 'Accra, Ghana',
    locationValidated: !!deliveryCoordinates,
    createdAt: new Date().toISOString()
  };

  // Initialize customer location if provided and valid
  if (deliveryCoordinates && deliveryAddress) {
    customerLocations[orderId] = {
      coordinates: deliveryCoordinates,
      address: deliveryAddress,
      timestamp: new Date().toISOString(),
      validated: true,
      socketId: null
    };
  }

  console.log(`📝 ✅ New Accra order created: ${orderId}`, {
    address: deliveryAddress,
    hasCoordinates: !!deliveryCoordinates,
    validated: !!deliveryCoordinates
  });
  
  res.json({ 
    orderId, 
    message: 'Order created successfully',
    deliveryArea: 'Accra, Ghana',
    locationValidated: !!deliveryCoordinates
  });
});

app.get('/api/orders', (req, res) => {
  res.json({
    orders: Object.values(orders),
    courierLocations: Object.values(courierLocations),
    customerLocations: Object.values(customerLocations),
    deliveryArea: 'Accra, Ghana',
    totalValidatedLocations: Object.values(customerLocations).filter(loc => loc.validated).length
  });
});

// Get delivery distance and ETA (enhanced with Accra validation)
app.get('/api/orders/:orderId/delivery-info', (req, res) => {
  const { orderId } = req.params;
  const courierLocation = courierLocations[orderId];
  const customerLocation = customerLocations[orderId];
  
  if (!courierLocation?.location || !customerLocation?.coordinates) {
    return res.json({
      orderId,
      distance: null,
      eta: null,
      message: 'Insufficient location data',
      deliveryArea: 'Accra, Ghana'
    });
  }

  // Validate both locations are in Accra
  const courierInAccra = isWithinAccra(courierLocation.location.lat, courierLocation.location.lng);
  const customerInAccra = isWithinAccra(customerLocation.coordinates[0], customerLocation.coordinates[1]);

  // Calculate distance
  const R = 6371; // Earth's radius in kilometers
  const dLat = (customerLocation.coordinates[0] - courierLocation.location.lat) * Math.PI / 180;
  const dLon = (customerLocation.coordinates[1] - courierLocation.location.lng) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(courierLocation.location.lat * Math.PI / 180) * Math.cos(customerLocation.coordinates[0] * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;

  // Calculate ETA (faster within Accra - 30 km/h average)
  const speedKmh = 30; // Higher speed within city
  const etaHours = distance / speedKmh;
  const etaMinutes = Math.round(etaHours * 60);

  res.json({
    orderId,
    distance: parseFloat(distance.toFixed(2)),
    eta: etaMinutes,
    etaFormatted: etaMinutes < 60 ? `${etaMinutes} min` : `${Math.round(etaHours * 10) / 10}h`,
    courierLocation: courierLocation.location,
    customerLocation: customerLocation.coordinates,
    courierInAccra,
    customerInAccra,
    deliveryArea: 'Accra, Ghana',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for real-time tracking`);
  console.log(`🌐 Frontend should connect to: http://localhost:${PORT}`);
  console.log(`📍 Delivery limited to: Accra, Ghana`);
  console.log(`🗺️  Accra bounds:`, ACCRA_BOUNDS);
  console.log(`✅ Location validation enabled`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
  });
});

// Log statistics every 10 minutes
setInterval(() => {
  const validatedLocations = Object.values(customerLocations).filter(loc => loc.validated).length;
  const stats = {
    activeConnections: activeConnections.size,
    activeOrders: Object.keys(courierLocations).length,
    customerLocations: Object.keys(customerLocations).length,
    validatedAccraLocations: validatedLocations,
    deliveryArea: 'Accra, Ghana',
    timestamp: new Date().toISOString()
  };
  console.log('📊 Accra delivery stats:', stats);
}, 10 * 60 * 1000);