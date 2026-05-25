import sys
import re

dashboard_path = r'c:\Users\Sayan\Desktop\truthlens\frontend\src\app\dashboard\page.jsx'
view_path = r'c:\Users\Sayan\Desktop\truthlens\frontend\src\components\ui\DashboardView.jsx'

with open(dashboard_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace export default function DashboardPage() with export default function DashboardView()
view_content = content.replace('export default function DashboardPage()', 'export default function DashboardView()')

# We need to remove the wrapper <div className="min-h-screen bg-[var(--surface-bright)]">
# and the <header> block.
# Let's find the return statement
return_idx = view_content.find('return (')
if return_idx == -1:
    print('Could not find return statement')
    sys.exit(1)

# Find the start of the inner div
inner_div_idx = view_content.find('<div className="max-w-6xl mx-auto px-4 md:px-6 py-10">', return_idx)

# We want everything before return (
prefix = view_content[:return_idx]

# We want to replace the whole return block with just returning the inner div (which goes until the second to last } )
# The file ends with:
#       </div>
#     </div>
#   );
# }
suffix = view_content[inner_div_idx:]
# Remove the last </div>
suffix = suffix.rsplit('</div>', 1)[0]

new_view_content = prefix + 'return (\n    <div className="flex-1 overflow-y-auto bg-[var(--surface-bright)] w-full h-full">\n      ' + suffix.strip() + '\n    </div>\n  );\n}\n'

with open(view_path, 'w', encoding='utf-8') as f:
    f.write(new_view_content)

new_dashboard_content = '''"use client";
import DashboardView from "@/components/ui/DashboardView";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface-bright)]">
      <header className="border-b border-[var(--border-color)] px-6 py-3 flex items-center justify-between shrink-0">
        <Link href="/" className="text-xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "'Newsreader', serif" }}>
          TruthLens
        </Link>
        <span className="text-xs uppercase tracking-wider text-[var(--text-secondary)]" style={{ fontFamily: "'Work Sans', sans-serif" }}>
          {user ? "Personal Stats" : "Dashboard"}
        </span>
      </header>
      <DashboardView />
    </div>
  );
}
'''

with open(dashboard_path, 'w', encoding='utf-8') as f:
    f.write(new_dashboard_content)

print('Success')
