import StudentDashboard from '@/components/StudentDashboard';

export default function Home() {
  return (
    <main>
      <StudentDashboard
        studentName="Juan Pérez"
        course="3ro BGU"
        tutor="María González"
        initialBalance={100.0}
        savedAmount={75.0}
        totalExpenses={25.0}
        activities={[
          { id: '1', storeName: 'AgroRed', amount: -8.5, date: '11 Ago 2026' },
          { id: '2', storeName: 'Surcos Fit', amount: -5.0, date: '10 Ago 2026' },
          { id: '3', storeName: 'Surcasino', amount: -3.0, date: '09 Ago 2026' },
        ]}
      />
    </main>
  );
}
