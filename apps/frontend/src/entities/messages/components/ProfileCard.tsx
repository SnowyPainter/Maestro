import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Mail, Phone, MapPin } from "lucide-react";

interface ProfileCardProps {
  title?: string;
  data: any;
}

export function ProfileCard({ title, data }: ProfileCardProps) {
  if (typeof data !== 'object' || data === null) {
    return (
      <Card className="w-full max-w-lg">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <User className="w-8 h-8 text-muted-foreground" />
            <span>{String(data)}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { name, email, phone, location, avatar, bio, role } = data;

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          {title || name || "Profile"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {avatar && (
            <div className="flex justify-center">
              <img
                src={avatar}
                alt={name || "Profile"}
                className="w-20 h-20 rounded-full object-cover"
              />
            </div>
          )}

          <div className="space-y-3">
            {name && (
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{name}</span>
              </div>
            )}

            {role && (
              <div className="flex items-center gap-3">
                <span className="text-sm px-2 py-1 bg-primary/10 text-primary rounded">
                  {role}
                </span>
              </div>
            )}

            {email && (
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <a href={`mailto:${email}`} className="text-sm hover:underline">
                  {email}
                </a>
              </div>
            )}

            {phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <a href={`tel:${phone}`} className="text-sm hover:underline">
                  {phone}
                </a>
              </div>
            )}

            {location && (
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{location}</span>
              </div>
            )}

            {bio && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">{bio}</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
