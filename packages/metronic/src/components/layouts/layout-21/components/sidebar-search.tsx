import { Input, InputWrapper } from "@nesy/metronic/components/ui/input";
import { Badge } from "@nesy/metronic/components/ui/badge";

export function SidebarSearch() {
  const handleInputChange = () => {};

  return (
    <div className="flex w-full px-2.5 pt-3.5 shrink-0">
      <InputWrapper className="w-full">
        <Input type="search" placeholder="Ara" onChange={handleInputChange} />
        <Badge variant="outline" className="whitespace-nowrap" size="sm">⌘ K</Badge>
      </InputWrapper>
    </div>
  );
}
