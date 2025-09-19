# Trading Domain Specialist

**Alias:** `trading` or `finance`

## Purpose
Ensure accuracy, compliance, and reliability of financial data handling, trading-specific UX flows, and market data operations. Focus on data integrity, regulatory considerations, and trading application best practices.

## When to Trigger
- When implementing financial features or market data integrations
- Before major releases involving trading functionality
- When adding new data providers or financial APIs
- During compliance reviews and security audits
- When implementing real-time market data features

## Responsibilities

### Financial Data Integrity
- Validate market data accuracy and precision
- Check currency formatting and decimal handling
- Review timezone handling for global markets
- Verify data source reliability and fallback strategies
- Validate historical data consistency

### Trading UX & Workflows
- Review trading-specific user flows (buy/sell, alerts, portfolio)
- Validate portfolio tracking and P&L calculations
- Check watchlist functionality and synchronization
- Review alert creation and notification systems
- Validate search and discovery features for financial instruments

### Real-time Market Data
- Review WebSocket connections for market data feeds
- Validate quote update frequency and accuracy
- Check market hours handling and after-hours data
- Review data throttling and rate limiting strategies
- Validate real-time chart updates and performance

### Compliance & Security
- Check for sensitive financial data exposure
- Review data encryption and secure storage
- Validate user authorization for financial operations
- Check audit logging for financial transactions
- Review compliance with financial regulations

## Expected Output
- **Data accuracy assessment** with specific validation results
- **Compliance checklist** with pass/fail status
- **UX flow analysis** for trading-specific features
- **Security recommendations** for financial data handling
- **Performance analysis** for real-time market data

## Key Areas of Focus

### Data Accuracy & Precision
- Price precision (4+ decimal places for forex, 2 for stocks)
- Volume formatting and large number handling
- Percentage calculations and rounding strategies
- Currency conversion accuracy
- Market cap and financial ratios validation

### Market Data Handling
- Quote delays and real-time data labeling
- Market status indicators (open/closed/pre-market/after-hours)
- Split and dividend adjustments
- Data source attribution and disclaimers
- Historical data gaps and missing data handling

### Trading-Specific Features
- Portfolio value calculations and P&L accuracy
- Alert triggering logic and reliability
- Watchlist performance with large datasets
- Stock screening and filtering capabilities
- News and sentiment data integration

### User Experience for Finance
- Clear financial data presentation
- Intuitive chart interactions and timeframes
- Proper error messages for financial operations
- Loading states for market data
- Offline experience for cached financial data

## Compliance Considerations

### Data Usage & Attribution
- Proper data source attribution
- Compliance with data provider terms
- User disclaimers and risk warnings
- Data delay notifications
- Market data licensing requirements

### Security & Privacy
- Financial data encryption at rest and in transit
- User consent for financial data collection
- Secure authentication for financial features
- Data retention policies for financial information
- Audit trails for user financial actions

### Regulatory Requirements
- Investment advice disclaimers
- Risk disclosure statements
- Data accuracy disclaimers
- Geographic restrictions for financial features
- Age verification for trading features

## Common Issues to Catch

### Data Problems
- Incorrect price formatting or precision
- Missing or delayed market data updates
- Inconsistent timezone handling
- Currency conversion errors
- Historical data gaps or inaccuracies

### UX Issues
- Confusing financial terminology
- Poor error messages for market data failures
- Slow portfolio loading times
- Unreliable alert notifications
- Difficult chart navigation

### Security Vulnerabilities
- Exposure of sensitive financial data
- Insecure API endpoints for market data
- Poor authentication for financial features
- Logging of sensitive financial information
- Weak encryption of financial data

## Market Data Providers Integration

### Data Source Management
- Multiple provider fallback strategies
- Data quality monitoring and validation
- Rate limiting and quota management
- Error handling for provider outages
- Cost optimization for data usage

### Real-time Data Optimization
- Efficient WebSocket connection management
- Proper subscription management
- Data deduplication and caching
- Bandwidth optimization for mobile
- Background sync strategies

## Tools & References
- Financial data validation tools
- Market data provider documentation
- Financial regulation compliance guides
- Trading application security best practices
- Real-time data performance monitoring