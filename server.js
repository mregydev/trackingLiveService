const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Define geographic bounds
const GEO_BOUNDS = {
  southwest: { lat: 50.917, lng: 6.844 },
  northeast: { lat: 50.972, lng: 7.08 },
};

// Initialize vehicles with 12 telemetry data points
const vehicles = Array.from({ length: 10 }, (_, i) => ({
  id: (i + 1).toString(),
  name: `Vehicle #${i + 1}`,
  attributes: {
    speed: getRandomInRange(30, 60),
    batteryLevel: getRandomInRange(50, 100),
    temperature: getRandomInRange(20, 40),
    tirePressure: getRandomInRange(30, 35),
    motorEfficiency: getRandomInRange(85, 95),
    regenerativeBraking: Math.random() > 0.5,
    oilLevel: getRandomInRange(50, 100),
    brakeFluid: getRandomInRange(50, 100),
    coolantLevel: getRandomInRange(50, 100),
    fuelLevel: getRandomInRange(20, 70),
    engineLoad: getRandomInRange(50, 80),
    gpsAccuracy: getRandomInRange(5, 10),
  },
  position: getRandomPosition(),
  pathIndex: 0,
  pathDirection: 1, // 1 for forward, -1 for reverse
  hasIssue: false,
  errorMessage: "",
  issueTimer: 0, // Tracks how long the vehicle has had an issue
  status: "moving", // Initial status is moving
}));

// Predefined random paths for vehicles
const PATHS = Array.from({ length: 10 }, () => generateRandomPath());

function generateRandomPath() {
  const path = [];
  const steps = 20; // Number of steps in the path
  let currentPosition = getRandomPosition();

  for (let i = 0; i < steps; i++) {
    currentPosition = {
      lat: Math.max(
        GEO_BOUNDS.southwest.lat,
        Math.min(
          GEO_BOUNDS.northeast.lat,
          currentPosition.lat + (Math.random() * 0.002 - 0.001)
        )
      ),
      lng: Math.max(
        GEO_BOUNDS.southwest.lng,
        Math.min(
          GEO_BOUNDS.northeast.lng,
          currentPosition.lng + (Math.random() * 0.002 - 0.001)
        )
      ),
    };
    path.push(currentPosition);
  }

  return path;
}

// Generate a random position within the specified geographic bounds
function getRandomPosition() {
  const lat = getRandomInRange(GEO_BOUNDS.southwest.lat, GEO_BOUNDS.northeast.lat);
  const lng = getRandomInRange(GEO_BOUNDS.southwest.lng, GEO_BOUNDS.northeast.lng);
  return { lat, lng };
}

// Utility function to get a random number within a range
function getRandomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

// Function to determine if a vehicle has an issue
function determineIssue(vehicle) {
  const issues = [];

  if (vehicle.hasIssue && vehicle.issueTimer > 0) {
    // Vehicle is already in an issue state, decrement issue timer
    vehicle.issueTimer--;
    if (vehicle.issueTimer === 0) {
      // Clear the issue if timer reaches 0
      vehicle.hasIssue = false;
      vehicle.errorMessage = "";
    }
    return vehicle;
  }

  if (!vehicle.hasIssue && Math.random() > 0.7) { // 30% chance a vehicle gets an issue
    if (vehicle.attributes.batteryLevel < 20) issues.push("Low battery level");
    if (vehicle.attributes.tirePressure < 28 || vehicle.attributes.tirePressure > 36) issues.push("Tire pressure out of range");
    if (vehicle.attributes.temperature > 50) issues.push("Overheating");
    if (!vehicle.attributes.regenerativeBraking) issues.push("Regenerative braking disabled");

    if (issues.length > 0) {
      vehicle.hasIssue = true;
      vehicle.errorMessage = issues.join(", ");
      vehicle.issueTimer = Math.floor(getRandomInRange(180, 240)); // Issue lasts for 3-4 minutes
    }
  } else if (vehicle.hasIssue) {
    // Ensure the error message is retained if vehicle still has an issue
    vehicle.errorMessage = vehicle.errorMessage || "Unknown issue";
  }

  return vehicle;
}

// Generate random updates for vehicle attributes
function getRandomUpdate(vehicle, index) {
  const path = PATHS[index];
  const updatedVehicle = {
    ...vehicle,
    attributes: {
      ...vehicle.attributes,
      speed: Math.max(10, Math.min(120, vehicle.attributes.speed + (Math.random() * 10 - 5))),
      batteryLevel: Math.max(0, vehicle.attributes.batteryLevel - Math.random() * 1.5),
      temperature: Math.max(15, Math.min(60, vehicle.attributes.temperature + (Math.random() * 2 - 1))),
      tirePressure: Math.max(25, Math.min(40, vehicle.attributes.tirePressure + (Math.random() * 0.5 - 0.25))),
      motorEfficiency: Math.max(70, Math.min(100, vehicle.attributes.motorEfficiency + (Math.random() * 0.5 - 0.25))),
      regenerativeBraking: Math.random() > 0.1, // 10% chance to disable
      oilLevel: Math.max(0, vehicle.attributes.oilLevel - Math.random() * 0.5),
      brakeFluid: Math.max(0, vehicle.attributes.brakeFluid - Math.random() * 0.5),
      coolantLevel: Math.max(0, vehicle.attributes.coolantLevel - Math.random() * 0.5),
      fuelLevel: Math.max(0, vehicle.attributes.fuelLevel - Math.random() * 1),
      engineLoad: Math.max(40, Math.min(90, vehicle.attributes.engineLoad + (Math.random() * 2 - 1))),
      gpsAccuracy: Math.max(3, Math.min(15, vehicle.attributes.gpsAccuracy + (Math.random() * 0.2 - 0.1))),
    },
    position: path[vehicle.pathIndex],
    pathIndex:
      vehicle.pathIndex + vehicle.pathDirection >= path.length ||
      vehicle.pathIndex + vehicle.pathDirection < 0
        ? vehicle.pathIndex - vehicle.pathDirection // Reverse direction
        : vehicle.pathIndex + vehicle.pathDirection,
    pathDirection:
      vehicle.pathIndex + vehicle.pathDirection >= path.length ||
      vehicle.pathIndex + vehicle.pathDirection < 0
        ? -vehicle.pathDirection
        : vehicle.pathDirection,
    status: vehicle.attributes.speed > 0 ? "moving" : "not", // Update status based on speed
  };

  return determineIssue(updatedVehicle);
}

// Set up Socket.IO connection
io.on('connection', (socket) => {
  console.log('Client connected');

  // Emit initial vehicles list to the client
  socket.emit('vehicles', vehicles);

  // Update vehicles at regular intervals
  setInterval(() => {
    vehicles.forEach((vehicle, index) => {
      if (Math.random() > 0.5) { // 50% chance to send data for a vehicle
        const updatedVehicle = getRandomUpdate(vehicle, index);
        vehicles[index] = updatedVehicle;

        // Emit updates for the selected vehicle
        socket.emit('vehicleUpdate', updatedVehicle);
      }
    });
  }, 1000); // Update every 1 second

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
