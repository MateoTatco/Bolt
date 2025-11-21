# Azure SQL Firewall Setup

## Current IP Address to Add
**IP Address**: `34.34.233.196`

## How to Add Firewall Rule

### Method 1: Azure Portal (Recommended)
1. Go to https://portal.azure.com
2. Navigate to: **SQL servers** → **tatco** (your SQL server name)
3. In the left menu, click **Security** → **Networking**
4. Under **Firewall rules**, click **"+ Add client IP"** or **"+ Add a firewall rule"**
5. Enter:
   - **Rule name**: `Firebase Functions - Current IP` (or any descriptive name)
   - **Start IP address**: `34.34.233.196`
   - **End IP address**: `34.34.233.196`
6. Click **Save**
7. Wait up to 5 minutes for the change to take effect

### Method 2: Azure CLI
```bash
az sql server firewall-rule create \
  --resource-group tatcoresourcegroup \
  --server tatco \
  --name FirebaseFunctionsIP \
  --start-ip-address 34.34.233.196 \
  --end-ip-address 34.34.233.196
```

### Method 3: SQL Command (if you have access)
```sql
EXEC sp_set_firewall_rule 
    @name = N'Firebase Functions IP',
    @start_ip_address = '34.34.233.196',
    @end_ip_address = '34.34.233.196';
```

## Important Notes

⚠️ **Firebase Functions use dynamic IP addresses** - the IP `34.34.233.196` may change in the future.

### Better Long-Term Solutions

#### Option 1: Allow Azure Services (Recommended)
1. In Azure Portal → SQL Server → Security → Networking
2. Enable **"Allow Azure services and resources to access this server"**
3. This allows all Azure services (including Firebase Functions running on Google Cloud) - but note Firebase Functions run on Google Cloud, not Azure

#### Option 2: Use Private Endpoint (Most Secure)
- Set up a private endpoint for Azure SQL
- This requires VNet integration

#### Option 3: Monitor and Update IPs
- Firebase Functions IPs can change
- You may need to check logs and add new IPs as they appear
- Consider creating a script to monitor and update firewall rules

## Current Status
- **IP Address**: `34.34.233.196`
- **Region**: Firebase Functions deployed in `us-central1` (Google Cloud)
- **Wait Time**: Up to 5 minutes after adding the rule

## Testing
After adding the firewall rule, test the connection by:
1. Refreshing the Project Profitability dashboard
2. Checking Firebase Functions logs for connection errors
3. If still failing, check if the IP has changed

