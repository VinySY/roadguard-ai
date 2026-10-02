import { Municipality, RoadIssue } from '../types';
import { storage } from './storage';

export interface DispatchReceipt {
  success: boolean;
  referenceNumber: string;
  dispatchedTo: {
    municipalityName: string;
    department: string;
    email: string;
    helpline: string;
    slaHours: number;
  };
  dispatchedAt: string;
  deliveryStatus: 'delivered' | 'queued' | 'simulated';
  demoNotice: string;
}

/**
 * Determines the relevant municipality based on coordinates or chosen district.
 */
export function matchMunicipality(lat?: number, lng?: number, areaName?: string): Municipality {
  const municipalities = storage.getMunicipalities();

  if (areaName) {
    const lower = areaName.toLowerCase();
    if (lower.includes('mohali') || lower.includes('airport')) {
      const match = municipalities.find((m) => m.id === 'muni-2');
      if (match) return match;
    }
    if (lower.includes('panchkula')) {
      const match = municipalities.find((m) => m.id === 'muni-3');
      if (match) return match;
    }
    if (lower.includes('highway') || lower.includes('nh-') || lower.includes('expressway')) {
      const match = municipalities.find((m) => m.id === 'muni-4');
      if (match) return match;
    }
  }

  if (lat && lng) {
    // Spatial boundary heuristic for Chandigarh tri-city area
    if (lat < 30.69) {
      const match = municipalities.find((m) => m.id === 'muni-2'); // Mohali
      if (match) return match;
    }
    if (lng > 76.84) {
      const match = municipalities.find((m) => m.id === 'muni-3'); // Panchkula
      if (match) return match;
    }
  }

  // Default to Municipal Corporation Chandigarh
  return municipalities[0];
}

/**
 * Sends a simulated official municipal email dispatch with full structured summary.
 */
export async function sendMunicipalEmailDispatch(
  issue: RoadIssue,
  municipality: Municipality
): Promise<DispatchReceipt> {
  // Simulate network latency for dispatch
  await new Promise((resolve) => setTimeout(resolve, 800));

  const receipt: DispatchReceipt = {
    success: true,
    referenceNumber: issue.referenceNumber,
    dispatchedTo: {
      municipalityName: municipality.name,
      department: municipality.department,
      email: municipality.contactEmail,
      helpline: municipality.helpline,
      slaHours: municipality.slaHours,
    },
    dispatchedAt: new Date().toISOString(),
    deliveryStatus: 'delivered',
    demoNotice: 'Simulation Mode: Configured with demo municipal gateway. No real emergency servers were contacted.',
  };

  return receipt;
}
