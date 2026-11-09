import { http } from "../../lib/api";

export interface FitnessAssessmentMetrics {
  weight?: number;
  bodyFatPercent?: number;
  muscleMass?: number;
  waterPercent?: number;
  visceralFatLevel?: number;
  bmr?: number;
  notes?: string;
}

export interface FitnessAssessment {
  id: string;
  memberId: string;
  gymId: string;
  assessmentDate: string;
  metrics: FitnessAssessmentMetrics;
  createdById?: string | null;
}

export const assessmentsApi = {
  getAssessments: (memberId: string) =>
    http.get<FitnessAssessment[]>(`/members/${memberId}/assessments`),

  createAssessment: (
    memberId: string,
    dto: {
      metrics: FitnessAssessmentMetrics;
      assessmentDate?: string;
    }
  ) => http.post<FitnessAssessment>(`/members/${memberId}/assessments`, dto),
};

