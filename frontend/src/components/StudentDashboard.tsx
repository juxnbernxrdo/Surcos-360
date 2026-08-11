'use client';

import React, { useState } from 'react';

interface StudentDashboardProps {
  studentName: string;
  course: string;
  tutor: string;
  initialBalance: number;
  savedAmount: number;
  totalExpenses: number;
  activities: Array<{
    id: string;
    storeName: string;
    amount: number;
    date: string;
  }>;
}

export default function StudentDashboard({
  studentName,
  course,
  tutor,
  initialBalance,
  savedAmount,
  totalExpenses,
  activities,
}: StudentDashboardProps) {
  const currentBalance = initialBalance - totalExpenses + savedAmount;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header Section */}
        <header className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl p-6 shadow-xl transition-all">
          <h1 className="text-2xl font-bold text-emerald-400">Hola, {studentName}</h1>
          <p className="text-slate-400 text-sm mt-1">
            Curso: <span className="text-slate-200 font-medium">{course}</span> · Tutor: <span className="text-slate-200 font-medium">{tutor}</span>
          </p>
        </header>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-5 hover:border-emerald-500/30 transition-colors">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Monto Inicial</span>
            <div className="text-2xl font-bold text-slate-100 mt-2">${initialBalance.toFixed(2)}</div>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-5 hover:border-emerald-500/30 transition-colors">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Saldo Disponible</span>
            <div className="text-2xl font-bold text-emerald-400 mt-2">${currentBalance.toFixed(2)}</div>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-5 hover:border-rose-500/30 transition-colors">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Gastos Totales</span>
            <div className="text-2xl font-bold text-rose-400 mt-2">-${totalExpenses.toFixed(2)}</div>
          </div>
        </div>

        {/* Activity Section */}
        <section className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-lg font-semibold text-slate-200">Actividad Reciente</h2>

          {activities.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              No tienes movimientos registrados todavía.
            </div>
          ) : (
            <div className="divide-y divide-slate-700/40">
              {activities.map((act) => (
                <div key={act.id} className="py-3 flex justify-between items-center hover:bg-slate-700/20 px-2 rounded-lg transition-colors">
                  <div>
                    <div className="font-medium text-slate-200">{act.storeName}</div>
                    <div className="text-xs text-slate-400">{act.date}</div>
                  </div>
                  <div className={`font-semibold ${act.amount < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {act.amount < 0 ? '-' : '+'}${Math.abs(act.amount).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
