-- ================================================
-- RoadGuard AI — Database Schema
-- ================================================
-- Run this file to initialize the RoadGuard database.
-- Usage: mysql -u root < server/db/schema.sql
-- ================================================

CREATE DATABASE IF NOT EXISTS roadguard
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE roadguard;

-- ================================================
-- Table 1: inspections
-- Stores metadata for each pothole detection run.
-- ================================================
CREATE TABLE IF NOT EXISTS inspections (
  id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  image_filename  VARCHAR(512)    NOT NULL,
  image_path      VARCHAR(1024)   DEFAULT NULL,
  image_width     INT UNSIGNED    NOT NULL DEFAULT 0,
  image_height    INT UNSIGNED    NOT NULL DEFAULT 0,
  detection_count INT UNSIGNED    NOT NULL DEFAULT 0,
  unique_pothole_count INT UNSIGNED DEFAULT NULL,
  overall_risk    ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'LOW',
  damage_percentage DECIMAL(7, 2) NOT NULL DEFAULT 0.00,
  confidence_threshold INT UNSIGNED NOT NULL DEFAULT 20,
  latitude        DECIMAL(10, 7)  DEFAULT NULL,
  longitude       DECIMAL(11, 7)  DEFAULT NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_inspections_created (created_at),
  INDEX idx_inspections_risk (overall_risk),
  INDEX idx_inspections_location (latitude, longitude)
) ENGINE=InnoDB;

-- ================================================
-- Table 2: detections
-- Stores individual pothole detections per inspection.
-- ================================================
CREATE TABLE IF NOT EXISTS detections (
  id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  inspection_id   INT UNSIGNED    NOT NULL,
  class_name      VARCHAR(128)    NOT NULL DEFAULT 'pothole',
  confidence      DECIMAL(5, 4)   NOT NULL DEFAULT 0.0000,
  severity        ENUM('minor', 'moderate', 'high', 'critical') NOT NULL DEFAULT 'minor',
  x               DECIMAL(10, 2)  NOT NULL DEFAULT 0.00,
  y               DECIMAL(10, 2)  NOT NULL DEFAULT 0.00,
  width           DECIMAL(10, 2)  NOT NULL DEFAULT 0.00,
  height          DECIMAL(10, 2)  NOT NULL DEFAULT 0.00,
  polygon_points  JSON            DEFAULT NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_detections_inspection (inspection_id),
  CONSTRAINT fk_detections_inspection
    FOREIGN KEY (inspection_id) REFERENCES inspections(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- ================================================
-- Table 3: road_issues
-- Stores user-reported road issues / complaints.
-- ================================================
CREATE TABLE IF NOT EXISTS road_issues (
  id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  category        VARCHAR(128)    NOT NULL,
  description     TEXT            NOT NULL,
  latitude        DECIMAL(10, 7)  DEFAULT NULL,
  longitude       DECIMAL(11, 7)  DEFAULT NULL,
  severity        ENUM('minor', 'moderate', 'high', 'critical') NOT NULL DEFAULT 'minor',
  status          ENUM('Reported', 'In Inspection', 'Scheduled for Repair', 'Resolved')
                                  NOT NULL DEFAULT 'Reported',
  evidence_path   VARCHAR(1024)   DEFAULT NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_issues_status (status),
  INDEX idx_issues_severity (severity),
  INDEX idx_issues_location (latitude, longitude),
  INDEX idx_issues_created (created_at)
) ENGINE=InnoDB;
