import * as userService from '../services/user.service.js';

export async function getProfile(req, res) {
  const user = await userService.getProfile(req.user.id);
  res.json(user);
}

export async function updateProfile(req, res) {
  const user = await userService.updateProfile(req.user.id, req.body);
  res.json(user);
}

export async function changePassword(req, res) {
  await userService.changePassword(req.user.id, req.body);
  res.json({ message: 'Password changed. Please log in again on other devices.' });
}

export async function getLocations(req, res) {
  const locations = await userService.getLocations(req.user.id);
  res.json(locations);
}

export async function addLocation(req, res) {
  const location = await userService.addLocation(req.user.id, req.body);
  res.status(201).json(location);
}

export async function updateLocation(req, res) {
  const location = await userService.updateLocation(req.user.id, req.params.id, req.body);
  res.json(location);
}

export async function deleteLocation(req, res) {
  await userService.deleteLocation(req.user.id, req.params.id);
  res.json({ message: 'Location deleted' });
}

export async function setDefaultLocation(req, res) {
  const location = await userService.setDefaultLocation(req.user.id, req.params.id);
  res.json(location);
}
