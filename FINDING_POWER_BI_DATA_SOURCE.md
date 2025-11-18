# Finding Power BI Data Source for Procore

## Goal
Find out how Power BI is getting the correct Budget data ($284,851 for Est Cost, $276,699 for Job To Date Cost) so we can replicate it in our API integration.

## Steps to Find the Data Source

### Option 1: Power BI Desktop (If you have access)

1. **Open Power BI Desktop**
2. **Open the "Project Profitability" report**
3. **Check Data Sources:**
   - Click on "Transform Data" or "Home" tab
   - Look for "Data Source Settings" or "Manage Parameters"
   - Check what data sources are listed

4. **View Power Query (M Code):**
   - Click "Transform Data" to open Power Query Editor
   - In the left pane, find the query that contains Procore data
   - Right-click on the query → "Advanced Editor"
   - Copy the M code - this will show us exactly which API endpoints are being used

5. **Check Query Steps:**
   - In Power Query Editor, look at the "Applied Steps" on the right
   - Find steps that mention "Procore", "Budget", "API", or URLs
   - This will show us the data transformation process

### Option 2: Power BI Service (Web)

1. **Go to Power BI Service** (app.powerbi.com)
2. **Open the "Project Profitability" workspace/report**
3. **Check Settings:**
   - Click on the "..." (three dots) menu for the dataset
   - Select "Settings"
   - Look for "Data source credentials" or "Data source"
   - Check what type of data source is listed (e.g., "Procore API", "OData", "REST API", etc.)

4. **Check Refresh History:**
   - In Settings, look for "Scheduled refresh" or "Refresh history"
   - This might show connection details

### Option 3: Check for Procore Connector

1. **In Power BI Desktop:**
   - Go to "Get Data" → "More..."
   - Search for "Procore"
   - If there's an official Procore connector, note its name and version

2. **Check if it's a Custom Connector:**
   - Look in the Power BI Desktop folder: `Documents\Power BI Desktop\Custom Connectors`
   - Or check if there's a custom connector file (.mez)

### Option 4: Check Dataflow (If Used)

1. **In Power BI Service:**
   - Go to your workspace
   - Look for "Dataflows" in the left navigation
   - If there's a dataflow, open it to see the data source

## What to Look For

When you find the data source, please share:

1. **Data Source Type:**
   - Is it a Procore connector?
   - Is it a REST API connection?
   - Is it OData?
   - Is it a custom connector?

2. **API Endpoints Used:**
   - What URLs/endpoints are being called?
   - Are they using `/rest/v1.0/` or `/rest/v2.0/`?
   - Are they using `/vapid/` endpoints?

3. **Power Query M Code:**
   - If you can access the M code, share it (or at least the parts that show API calls)
   - This will show us exactly which endpoints and parameters are used

4. **Authentication Method:**
   - How is Power BI authenticating with Procore?
   - OAuth? API Key? Service Account?

## Example of What We're Looking For

If you see something like this in Power Query:
```
let
    Source = Web.Contents("https://api.procore.com/rest/v2.0/companies/.../projects/.../budget", ...)
in
    Source
```

Or if you see a Procore connector that shows:
- Endpoint: `/rest/v2.0/budgets` or similar
- Parameters used for Budget data

## Next Steps

Once we know how Power BI is getting the data, we can:
1. Use the same API endpoints in our Firebase Functions
2. Replicate the same authentication method
3. Use the same query parameters
4. Match the data transformation logic

This should give us the exact same data that Power BI is showing!

