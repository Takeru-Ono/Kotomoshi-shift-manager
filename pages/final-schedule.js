import FinalShifts from "../components/FinalShifts";

export default function FinalSchedule() {
  // user情報が必要な場合はここで取得・管理する必要あり
  // ここではnullを渡す（必要に応じて認証連携を追加してください）
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">確定版シフト</h1>
      <FinalShifts user={null} />
    </div>
  );
}
