import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, UserCog, Phone, Mail } from 'lucide-react';

const sampleStaff = [
  { id: 1, name: '홍시표', role: '원장', phone: '010-xxxx-xxxx', email: 'hong@daechion.kr' },
  { id: 2, name: '김조교', role: '조교', phone: '010-xxxx-xxxx', email: 'kim@daechion.kr' },
  { id: 3, name: '이조교', role: '조교', phone: '010-xxxx-xxxx', email: 'lee@daechion.kr' },
  { id: 4, name: '박매니저', role: '매니저', phone: '010-xxxx-xxxx', email: 'park@daechion.kr' },
];

const roleColor: Record<string, string> = {
  원장: 'bg-orange-100 text-orange-700',
  조교: 'bg-blue-100 text-blue-700',
  매니저: 'bg-purple-100 text-purple-700',
};

export default function StaffPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">직원 관리</h1>
        <Button className="bg-orange-500 hover:bg-orange-600 text-white">
          <Plus className="h-4 w-4 mr-1" />
          조교 추가
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sampleStaff.map((staff) => (
          <Card key={staff.id} className="hover:shadow-md transition-shadow">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="h-12 w-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-lg font-semibold shrink-0">
                {staff.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium">{staff.name}</p>
                  <Badge className={roleColor[staff.role]}>{staff.role}</Badge>
                </div>
                <div className="flex flex-col gap-0.5 text-xs text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3" />
                    {staff.phone}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3" />
                    {staff.email}
                  </span>
                </div>
              </div>
              <UserCog className="h-5 w-5 text-zinc-300 shrink-0 cursor-pointer hover:text-zinc-500" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
