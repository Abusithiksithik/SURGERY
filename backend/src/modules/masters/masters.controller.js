'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const services = require('./masters.service');

/** Builds the standard REST handlers for one master-data service (with optional activate). */
function buildControllerFor(service, entityName) {
  const ctrl = {
    list: asyncHandler(async (req, res) => {
      const { items, meta } = await service.list(req.query);
      return new ApiResponse(200, items, `${entityName} list`, meta).send(res);
    }),
    getById: asyncHandler(async (req, res) => {
      const item = await service.getById(req.params.id);
      return new ApiResponse(200, item).send(res);
    }),
    create: asyncHandler(async (req, res) => {
      const item = await service.create(req.body);
      return new ApiResponse(201, item, `${entityName} created`).send(res);
    }),
    update: asyncHandler(async (req, res) => {
      const item = await service.update(req.params.id, req.body);
      return new ApiResponse(200, item, `${entityName} updated`).send(res);
    }),
    deactivate: asyncHandler(async (req, res) => {
      await service.deactivate(req.params.id);
      return new ApiResponse(200, null, `${entityName} deactivated`).send(res);
    }),
  };
  if (service.activate) {
    ctrl.activate = asyncHandler(async (req, res) => {
      const item = await service.activate(req.params.id);
      return new ApiResponse(200, item, `${entityName} activated`).send(res);
    });
  }
  return ctrl;
}

const deletePatient = asyncHandler(async (req, res) => {
  const result = await services.deletePatient(req.params.id);
  return new ApiResponse(200, result, 'Patient deactivated').send(res);
});

module.exports = {
  branches: buildControllerFor(services.branches, 'Branch'),
  departments: buildControllerFor(services.departments, 'Department'),
  surgeons: buildControllerFor(services.surgeons, 'Surgeon'),
  anaesthetists: buildControllerFor(services.anaesthetists, 'Anaesthetist'),
  assistants: buildControllerFor(services.assistants, 'Assistant'),
  surgeryTypes: buildControllerFor(services.surgeryTypes, 'Surgery type'),
  otRooms: buildControllerFor(services.otRooms, 'OT room'),
  patients: buildControllerFor(services.patients, 'Patient'),
  bloodGroups: buildControllerFor(services.bloodGroups, 'Blood group'),
  staff: buildControllerFor(services.staff, 'Staff'),
  appUsers: buildControllerFor(services.appUsers, 'App user'),
  deletePatient,
};
