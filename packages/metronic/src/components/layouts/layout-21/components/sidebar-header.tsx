import { useState } from 'react';
import { Check, ChevronsUpDown, Gem, Hexagon, Layers2, PanelRight } from 'lucide-react';
import { useLayout } from './context';
import { toAbsoluteUrl } from '@nesy/metronic/lib/helpers';
import { Button } from '@nesy/metronic/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@nesy/metronic/components/ui/dropdown-menu';
import { cn } from '@nesy/metronic/lib/utils';

interface Team {
  icon?: React.ElementType;
  name: string;
  color: string;
  members: number;
  isPrimary?: boolean;
}

/** Nesy Mobile uygulama ikonu (Android launcher asset'i). */
function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src={toAbsoluteUrl('/media/app/nesy-icon.png')}
      alt="Nesy Mobile"
      className={cn('shrink-0 rounded-lg', className)}
    />
  );
}

// Marka logosu — uygulama ikonu + yazı.
function BrandLogo() {
  return (
    <span className="inline-flex items-center gap-2" aria-label="Nesy Mobile Cockpit">
      <BrandMark className="size-7" />
      <span className="text-[17px] font-bold tracking-[-0.035em] text-foreground">
        Nesy<span className="text-orange-500">Mobile</span>
      </span>
    </span>
  );
}

export function SidebarHeader() {
  const { sidebarToggle } = useLayout();

  const teams: Team[] = [
    {
      name: 'Nesy Mobile',
      color: 'bg-zinc-900 text-orange-500 dark:bg-zinc-800',
      members: 8,
      isPrimary: true
    },
    {
      icon: Gem,
      name: "Clarity AI",
      color: "bg-fuchsia-600 text-white",
      members: 6
    },
    {
      icon: Hexagon,
      name: "Lightning AI",
      color: "bg-yellow-600 text-white",
      members: 12
    },
    {
      icon: Layers2,
      name: "Bold AI",
      color: "bg-blue-600 text-white",
      members: 4
    }
  ];

  const [selectedTeam, setSelectedTeam] = useState<Team>(teams[0]!);

  return (
    <div className="flex border-b border-border items-center gap-2 h-[calc(var(--header-height)-1px)]">
      <div className="flex items-center w-full">
        {/* Sidebar header */}
        <div className="flex w-full grow items-center justify-between px-5 gap-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="inline-flex text-muted-foreground hover:text-foreground px-1.5 -ms-1.5"
              >
                {selectedTeam.isPrimary ? (
                  <BrandLogo />
                ) : (
                  <>
                    <div className={cn("size-6 flex items-center justify-center rounded-md", selectedTeam.color)}>
                      {selectedTeam.icon && <selectedTeam.icon className="size-4" />}
                    </div>
                    <span className="text-foreground text-sm font-medium">
                      {selectedTeam.name}
                    </span>
                  </>
                )}
                <ChevronsUpDown className="opacity-100" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-56"
              side="bottom"
              align="end"
              sideOffset={10}
              alignOffset={-80}
            >
              {teams.map((team) => (
                <DropdownMenuItem key={team.name} onClick={() => setSelectedTeam(team)} data-active={selectedTeam.name === team.name}>
                  {team.isPrimary ? (
                    <BrandMark className="size-6 rounded-md" />
                  ) : (
                    <div className={cn("size-6 rounded-md flex items-center justify-center", team.color)}>
                      {team.icon && <team.icon className="size-4" />}
                    </div>
                  )}
                  <span className="text-foreground text-sm font-medium">
                    {team.name}
                  </span>
                  {selectedTeam.name === team.name && (
                    <Check className="ms-auto size-4 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sidebar toggle */}
          <Button
            mode="icon"
            variant="ghost"
            onClick={sidebarToggle}
            className="hidden lg:inline-flex text-muted-foreground hover:text-foreground"
          >
            <PanelRight className="opacity-100" />
          </Button>
        </div>
      </div>
    </div>
  );
}
