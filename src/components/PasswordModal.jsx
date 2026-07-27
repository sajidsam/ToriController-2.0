import React, { useState } from "react";
import { Lock, Unlock, X } from "lucide-react";

const PasswordModal = ({ isOpen, onClose, onSuccess }) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === "admin123") {
      // Hardcoded password as per plan
      setError("");
      setPassword("");
      onSuccess();
    } else {
      setError("Incorrect password. Please try again.");
      setPassword("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white/10 border border-white/20 p-6 rounded-lg shadow-2xl w-full max-w-sm text-white relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-white/50 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center mb-6">
          <div className="bg-white/10 p-3 rounded-full mb-3">
            <Lock size={32} className="text-white" />
          </div>
          <h2 className="text-xl font-bold tracking-wider">
            RESTRICTED ACCESS
          </h2>
          <p className="text-sm text-white/60 mt-1 text-center">
            Route Planning requires authorization.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <input
              type="password"
              placeholder="Enter Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/50 border border-white/20 rounded px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:border-white transition-colors"
              autoFocus
            />
            {error && (
              <p className="text-white text-xs mt-2 font-semibold bg-white/10 px-2 py-1 rounded border border-white/20 inline-block">{error}</p>
            )}
          </div>
          <button
            type="submit"
            className="w-full bg-white/20 hover:bg-white/30 border border-white/40 text-white font-bold py-2 rounded flex items-center justify-center gap-2 transition-colors"
          >
            <Unlock size={18} />
            AUTHORIZE
          </button>
        </form>
      </div>
    </div>
  );
};

export default PasswordModal;
