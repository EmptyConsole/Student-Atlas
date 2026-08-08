import { useState } from "react";
import { ArrowRight, Lock } from "lucide-react";
import { useSchools } from "../hooks/useSchools";
import {
  createSchool,
  loginToSchool,
  type SchoolInput,
  type UnlockedSession,
} from "../lib/teacher";
import SchoolPicker from "./SchoolPicker";
import SchoolFormModal, { type TermDraft } from "./teacher/SchoolFormModal";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "./teacher/formStyles";

type TeacherGateProps = {
  onUnlock: (school: UnlockedSession) => void;
};

function TeacherGate({ onUnlock }: TeacherGateProps) {
  const { schools, loading, error } = useSchools();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);

  const [addingSchool, setAddingSchool] = useState(false);
  const [created, setCreated] = useState<UnlockedSession | null>(null);

  const selectedSchool = schools.find((s) => s.id === selectedId) ?? null;

  const handleUnlock = async () => {
    if (!selectedSchool || verifying) return;
    setVerifying(true);
    setGateError(null);
    const result = await loginToSchool(selectedSchool.id, password);
    setVerifying(false);
    setPassword("");
    if (result.token && result.expiresAt) {
      onUnlock({
        id: selectedSchool.id,
        name: selectedSchool.name,
        token: result.token,
        expiresAt: result.expiresAt,
      });
    } else {
      setGateError(result.error ?? "Incorrect password for this school.");
    }
  };

  const handleCreateSchool = async (
    input: SchoolInput,
    terms: TermDraft[],
  ): Promise<{ error?: string }> => {
    const result = await createSchool(input, terms);
    if (result.error) return { error: result.error };
    if (result.data) setCreated(result.data);
    return {};
  };

  return (
    <div className="flex flex-1 items-start justify-center overflow-y-auto bg-detail-400 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-main-200 text-[#4169e1]">
            <Lock className="h-6 w-6" />
          </span>
          <h1 className="text-2xl font-bold text-gray-800">Teacher access</h1>
          <p className="mt-1 text-sm text-gray-500">
            Choose your school and enter its password to manage its catalog.
          </p>
        </div>

        {created ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-main-300 bg-white p-6 shadow-sm">
            <div className="rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-800">
              {created.name} was created.
            </div>
            <button
              type="button"
              onClick={() => onUnlock(created)}
              className={`${primaryButtonClass} flex w-full items-center justify-center gap-2`}
            >
              Go to {created.name} to edit
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setCreated(null)}
              className={secondaryButtonClass}
            >
              Back
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-5 rounded-2xl border border-main-300 bg-white p-6 shadow-sm">
            <div>
              <span className={labelClass}>School</span>
              <SchoolPicker
                schools={schools}
                loading={loading}
                error={error}
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId(id);
                  setGateError(null);
                }}
                placeholder="Select a school"
              />
            </div>

            <div>
              <label htmlFor="teacher-password" className={labelClass}>
                Password
              </label>
              <input
                id="teacher-password"
                type="password"
                value={password}
                disabled={!selectedSchool}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setGateError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleUnlock();
                }}
                placeholder="School password"
                className={`${inputClass} disabled:cursor-not-allowed disabled:bg-gray-100`}
              />
            </div>

            <button
              type="button"
              onClick={handleUnlock}
              disabled={!selectedSchool || verifying}
              className={`${primaryButtonClass} w-full`}
            >
              {verifying ? "Checking…" : "Unlock"}
            </button>

            {gateError && (
              <p className="text-sm font-medium text-red-600">{gateError}</p>
            )}

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-main-200" />
              <span className="text-xs font-medium text-gray-400">or</span>
              <span className="h-px flex-1 bg-main-200" />
            </div>

            <button
              type="button"
              onClick={() => setAddingSchool(true)}
              className={secondaryButtonClass}
            >
              Add a new school
            </button>
          </div>
        )}
      </div>

      {addingSchool && (
        <SchoolFormModal
          mode="add"
          onClose={() => setAddingSchool(false)}
          onSave={handleCreateSchool}
        />
      )}
    </div>
  );
}

export default TeacherGate;
