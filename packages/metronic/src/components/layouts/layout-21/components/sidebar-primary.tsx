import {
  Settings,
  Users,
  User,
  Clock,
  Shield,
  Building2,
  LogOut,
  Download,
  ExternalLink,
  Zap,
  Target,
  Sun,
  Moon,
} from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  AvatarIndicator,
  AvatarStatus,
} from '@nesy/metronic/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@nesy/metronic/components/ui/dropdown-menu';
import { Button } from '@nesy/metronic/components/ui/button';
import { Badge } from '@nesy/metronic/components/ui/badge';
import { useTheme } from 'next-themes';
import { ScrollArea } from '@nesy/metronic/components/ui/scroll-area';
import { cn } from '@nesy/metronic/lib/utils';
import { SidebarNavLink } from './navigation-feedback';
import { getVisibleWorkspaces } from '@nesy/metronic/config/menu-utils';
import { useOperationsAccess } from '@nesy/metronic/hooks/use-operations-access';

export function SidebarPrimary() {
  const { resolvedTheme, setTheme } = useTheme();
  
  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };
  
  const isDarkMode = resolvedTheme === 'dark';
  
  const hasOperationsAccess = useOperationsAccess();
  const workspaces = getVisibleWorkspaces(hasOperationsAccess);

  return (
    <div className="flex flex-col items-center justify-between shrink-0 py-2.5 gap-5 w-[70px] lg:w-(--sidebar-collapsed-width) bg-background">
      {/* Nav */}
      <div className="shrink-0 grow w-full">
        <ScrollArea className="shrink-0 h-[calc(100dvh-14rem)]">
          <div className="flex flex-col grow items-center gap-[10px] shrink-0">
              {workspaces.map((ws) => (
               <Button
                 key={ws.id}
                 asChild
                 variant="ghost"
                 mode="icon"
                 title={ws.label}
                 aria-label={ws.label}
                 className={cn(
                   'transition-all duration-300 rounded-lg shadow-sm border-2 hover:shadow-[0_4px_12px_0_rgba(37,47,74,0.35)] w-[34px] h-[34px]',
                   ws.className,
                 )}
               >
                <SidebarNavLink href={ws.path} navigationLabel={ws.label}>
                  <ws.icon/>
                </SidebarNavLink>
               </Button>
             ))}
           </div>
        </ScrollArea>
      </div>

      {/* Footer */}
      <div className="flex flex-col items-center gap-2.5 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger className="cursor-pointer mb-2.5">
            <Avatar className="size-7">
              <AvatarFallback>
                <User className="size-3.5 text-muted-foreground" />
              </AvatarFallback>
              <AvatarIndicator className="-end-2 -top-2">
                <AvatarStatus variant="online" className="size-2.5" />
              </AvatarIndicator>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 mb-4" side="right" align="start" sideOffset={11}>
            {/* User Information Section */}
            <div className="flex items-center gap-3 px-3 py-2">
              <Avatar>
                <AvatarFallback>
                  <User className="size-4 text-muted-foreground" />
                </AvatarFallback>
                <AvatarIndicator className="-end-1.5 -top-1.5">
                  <AvatarStatus variant="online" className="size-2.5" />
                </AvatarIndicator>
              </Avatar>
              <div className="flex flex-col items-start">
                <span className="text-sm font-semibold text-foreground">Chris Harris</span>
                <span className="text-xs text-muted-foreground">Senior Developer</span>
                <Badge variant="success" appearance="outline" size="sm" className="mt-1">Pro Plan</Badge>
              </div>
            </div>
            
            <DropdownMenuItem className="cursor-pointer py-1 rounded-md border border-border hover:bg-muted">
              <Clock/>
              <span>Set availability</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Core Actions */}
            <DropdownMenuItem>
              <Target/>
              <span>My Projects</span>
              <Badge variant="info" size="sm" appearance="outline" className="ms-auto">3</Badge>
            </DropdownMenuItem>

            <DropdownMenuItem>
              <Users/>
              <span>Team Management</span>
            </DropdownMenuItem>

            <DropdownMenuItem>
              <Building2/>
              <span>Organization</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Settings */}
            <DropdownMenuItem>
              <User/>
              <span>Profile Settings</span>
            </DropdownMenuItem>

            <DropdownMenuItem>
              <Settings/>
              <span>Preferences</span>
            </DropdownMenuItem>

            <DropdownMenuItem>
              <Shield/>
              <span>Security</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Theme Toggle */}
            <DropdownMenuItem onClick={toggleTheme}>
              {isDarkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}
              <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Developer Tools */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Zap/>
                <span>Developer Tools</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                <DropdownMenuItem>API Documentation</DropdownMenuItem>
                <DropdownMenuItem>Code Repository</DropdownMenuItem>
                <DropdownMenuItem>Testing Suite</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuItem>
              <Download/>
              <span>Download SDK</span>
              <ExternalLink className="size-3 ms-auto" />
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Action Items */}
            <DropdownMenuItem>
              <LogOut/>
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
