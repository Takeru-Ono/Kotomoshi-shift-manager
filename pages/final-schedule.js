import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";

export default function FinalSchedule() {
  const [finalShifts, setFinalShifts] = useState([]);

  useEffect(() => {
    const fetchFinalShifts = async () => {
      const querySnapshot = await getDocs(collection(db, "finalShifts"));
      const shiftData = querySnapshot.docs.map((doc) => doc.data().shifts).flat();
      setFinalShifts(shiftData);
    };
    fetchFinalShifts();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">確定版シフト</h1>
      <ul>
        {finalShifts.map((shift, index) => (
          <li key={index} className="border p-2 my-2 shadow-sm">
            {shift.date} {shift.startTime} - {shift.endTime}
          </li>
        ))}
      </ul>
    </div>
  );
}