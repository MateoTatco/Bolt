export const leadStatusOptions = [
    { value: 'new', label: 'New' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'qualified', label: 'Qualified' },
    { value: 'proposal', label: 'Proposal' },
    { value: 'won', label: 'Won' },
    { value: 'lost', label: 'Lost' },
]

export const methodOfContactOptions = [
    { value: 'email', label: 'Email' },
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'phone', label: 'Phone' },
    { value: 'meeting', label: 'Meeting' },
    { value: 'other', label: 'Other' },
]

export const projectMarketOptions = [
    { value: 'construction', label: 'Construction' },
    { value: 'manufacturing', label: 'Manufacturing' },
    { value: 'saas', label: 'SaaS' },
    { value: 'retail', label: 'Retail' },
    { value: 'other', label: 'Other' },
]

export const leadConceptionOptions = [
    { value: 'referral', label: 'Referral' },
    { value: 'inbound', label: 'Inbound' },
    { value: 'outbound', label: 'Outbound' },
    { value: 'event', label: 'Event' },
    { value: 'other', label: 'Other' },
]

export const leadsData = [
    {
        id: 1,
        leadName: 'Acme Corp',
        leadContact: 'Jane Smith',
        title: 'Operations Director',
        email: 'jane@acme.com',
        phone: '+1 555 123 4567',
        methodOfContact: 'email',
        dateLastContacted: '2025-10-08',
        projectMarket: 'construction',
        leadConception: 'referral',
        status: 'contacted',
        responded: true,
        notes: 'Asked for case studies',
        favorite: false,
        owner: 'Alex Thompson',
        clientIds: [],
        createdAt: '2025-09-30',
        updatedAt: '2025-10-08',
    },
    {
        id: 2,
        leadName: 'Bolt Industries',
        leadContact: 'Michael Lee',
        title: 'Project Manager',
        email: 'michael@bolt.com',
        phone: '+1 555 987 6543',
        methodOfContact: 'linkedin',
        dateLastContacted: '2025-10-07',
        projectMarket: 'manufacturing',
        leadConception: 'outbound',
        status: 'new',
        responded: false,
        notes: 'Cold outreach planned next week',
        favorite: false,
        owner: 'Sarah Wilson',
        clientIds: [],
        createdAt: '2025-10-01',
        updatedAt: '2025-10-07',
    },
]



