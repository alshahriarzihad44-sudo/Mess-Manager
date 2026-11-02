
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_MEMBERS 50
#define MAX_EXPENSES 500
#define NAME_LEN 50
#define TITLE_LEN 100
#define FILE_NAME "mess_data.dat"

typedef struct {
    char name[NAME_LEN];
    double deposit;
    int meals;
} Member;

typedef struct {
    char title[TITLE_LEN];
    double amount;
} Expense;

typedef struct {
    char month[20];
    int memberCount;
    int expenseCount;
    int mealsPerDay;

    Member members[MAX_MEMBERS];
    Expense expenses[MAX_EXPENSES];
} Mess;

Mess mess;

// ---------- INPUT FUNCTIONS ----------

int readInt(char message[]) {
    char input[100];
    int value;

    printf("%s", message);
    fgets(input, sizeof(input), stdin);

    value = atoi(input);
    return value;
}

double readDouble(char message[]) {
    char input[100];
    double value;

    printf("%s", message);
    fgets(input, sizeof(input), stdin);

    value = atof(input);
    return value;
}

void readString(char message[], char output[], int size) {
    printf("%s", message);
    fgets(output, size, stdin);

    output[strcspn(output, "\n")] = '\0';
}

// ---------- SAVE AND LOAD ----------

void saveData() {
    FILE *file = fopen(FILE_NAME, "wb");

    if (file == NULL) {
        printf("Data save kora jayni!\n");
        return;
    }

    fwrite(&mess, sizeof(Mess), 1, file);
    fclose(file);

    printf("Data successfully saved!\n");
}

void loadData() {
    FILE *file = fopen(FILE_NAME, "rb");

    if (file == NULL) {
        memset(&mess, 0, sizeof(Mess));

        readString("Enter month (e.g. November 2026): ",
                   mess.month, sizeof(mess.month));

        mess.mealsPerDay = 3;

        saveData();
        return;
    }

    fread(&mess, sizeof(Mess), 1, file);
    fclose(file);

    printf("Previous data loaded!\n");
}

// ---------- MEMBER MANAGEMENT ----------

void addMember() {
    if (mess.memberCount >= MAX_MEMBERS) {
        printf("Maximum member limit reached!\n");
        return;
    }

    Member *m = &mess.members[mess.memberCount];

    readString("Enter member name: ",
               m->name, sizeof(m->name));

    m->deposit = 0;
    m->meals = 0;

    mess.memberCount++;

    saveData();
}

void showMembers() {
    printf("\n--- MEMBER LIST ---\n");

    for (int i = 0; i < mess.memberCount; i++) {
        printf("%d. %s | Deposit: %.2f | Meals: %d\n",
               i + 1,
               mess.members[i].name,
               mess.members[i].deposit,
               mess.members[i].meals);
    }
}

void addDeposit() {
    showMembers();

    int id = readInt("\nMember number: ");

    if (id < 1 || id > mess.memberCount) {
        printf("Invalid member number!\n");
        return;
    }

    double amount = readDouble("Deposit amount: ");

    if (amount <= 0) {
        printf("Invalid amount!\n");
        return;
    }

    mess.members[id - 1].deposit += amount;

    saveData();
}

// ---------- MEAL MANAGEMENT ----------

void updateMeals() {
    showMembers();

    int id = readInt("\nMember number: ");

    if (id < 1 || id > mess.memberCount) {
        printf("Invalid member number!\n");
        return;
    }

    printf("Current meals: %d\n",
           mess.members[id - 1].meals);

    int meals = readInt(
        "Enter meal adjustment (+/-): ");

    if (mess.members[id - 1].meals + meals < 0) {
        printf("Meal cannot be negative!\n");
        return;
    }

    mess.members[id - 1].meals += meals;

    saveData();

    printf("Meal updated successfully!\n");
}

void changeMealType() {
    printf("\nCurrent meals per day: %d\n",
           mess.mealsPerDay);

    int meals = readInt(
        "Set meals per day (2 or 3): ");

    if (meals == 2 || meals == 3) {
        mess.mealsPerDay = meals;
        saveData();
    } else {
        printf("Please enter 2 or 3.\n");
    }
}

// ---------- EXPENSE MANAGEMENT ----------

void addExpense() {
    if (mess.expenseCount >= MAX_EXPENSES) {
        printf("Expense limit reached!\n");
        return;
    }

    Expense *e = &mess.expenses[mess.expenseCount];

    readString("Expense title: ",
               e->title, sizeof(e->title));

    e->amount = readDouble("Expense amount: ");

    if (e->amount <= 0) {
        printf("Invalid amount!\n");
        return;
    }

    mess.expenseCount++;

    saveData();
}

void showExpenses() {
    printf("\n--- EXPENSE LIST ---\n");

    for (int i = 0; i < mess.expenseCount; i++) {
        printf("%d. %s : %.2f\n",
               i + 1,
               mess.expenses[i].title,
               mess.expenses[i].amount);
    }
}

// ---------- MONTHLY REPORT ----------

void monthlyReport() {
    double totalExpense = 0;
    double totalDeposit = 0;
    int totalMeals = 0;

    printf("\n=================================\n");
    printf("      MONTHLY MESS REPORT\n");
    printf("      %s\n", mess.month);
    printf("=================================\n");

    for (int i = 0; i < mess.expenseCount; i++) {
        totalExpense += mess.expenses[i].amount;
    }

    for (int i = 0; i < mess.memberCount; i++) {
        totalDeposit += mess.members[i].deposit;
        totalMeals += mess.members[i].meals;
    }

    double mealRate = 0;

    if (totalMeals > 0) {
        mealRate = totalExpense / totalMeals;
    }

    printf("Total Members : %d\n", mess.memberCount);
    printf("Total Meals  : %d\n", totalMeals);
    printf("Total Expense: %.2f Tk\n", totalExpense);
    printf("Total Deposit: %.2f Tk\n", totalDeposit);
    printf("Meal Rate    : %.2f Tk\n", mealRate);

    printf("\n--- MEMBER DETAILS ---\n");

    double highestCost = -1;
    double lowestCost = 999999999;
    int highestIndex = -1;
    int lowestIndex = -1;

    double net[MAX_MEMBERS];

    for (int i = 0; i < mess.memberCount; i++) {
        double cost = mess.members[i].meals * mealRate;

        net[i] = mess.members[i].deposit - cost;

        printf("\nName       : %s\n",
               mess.members[i].name);

        printf("Meals      : %d\n",
               mess.members[i].meals);

        printf("Meal Cost  : %.2f Tk\n", cost);

        printf("Deposit    : %.2f Tk\n",
               mess.members[i].deposit);

        printf("Balance    : %.2f Tk\n", net[i]);

        if (cost > highestCost) {
            highestCost = cost;
            highestIndex = i;
        }

        if (cost < lowestCost) {
            lowestCost = cost;
            lowestIndex = i;
        }
    }

    if (highestIndex != -1) {
        printf("\nHighest spender: %s (%.2f Tk)\n",
               mess.members[highestIndex].name,
               highestCost);

        printf("Lowest spender : %s (%.2f Tk)\n",
               mess.members[lowestIndex].name,
               lowestCost);
    }

    // ---------- WHO PAYS WHOM ----------

    printf("\n--- SETTLEMENT ---\n");

    int debtor = 0;
    int creditor = 0;

    while (debtor < mess.memberCount &&
           creditor < mess.memberCount) {

        while (debtor < mess.memberCount &&
               net[debtor] >= -0.01) {
            debtor++;
        }

        while (creditor < mess.memberCount &&
               net[creditor] <= 0.01) {
            creditor++;
        }

        if (debtor >= mess.memberCount ||
            creditor >= mess.memberCount) {
            break;
        }

        double amount = -net[debtor];

        if (net[creditor] < amount) {
            amount = net[creditor];
        }

        printf("%s will pay %s : %.2f Tk\n",
               mess.members[debtor].name,
               mess.members[creditor].name,
               amount);

        net[debtor] += amount;
        net[creditor] -= amount;
    }

    printf("\n=================================\n");
}

// ---------- MAIN MENU ----------

int main() {
    loadData();

    int choice;

    do {
        printf("\n\n====== MESS CALCULATOR ======\n");
        printf("Month: %s\n", mess.month);

        printf("1. Add Member\n");
        printf("2. Show Members\n");
        printf("3. Add Deposit\n");
        printf("4. Update Daily Meals\n");
        printf("5. Change Meals Per Day\n");
        printf("6. Add Expense\n");
        printf("7. Show Expenses\n");
        printf("8. Monthly Report\n");
        printf("9. Save Data\n");
        printf("0. Exit\n");

        choice = readInt("Choose option: ");

        switch (choice) {
            case 1:
                addMember();
                break;

            case 2:
                showMembers();
                break;

            case 3:
                addDeposit();
                break;

            case 4:
                updateMeals();
                break;

            case 5:
                changeMealType();
                break;

            case 6:
                addExpense();
                break;

            case 7:
                showExpenses();
                break;

            case 8:
                monthlyReport();
                break;

            case 9:
                saveData();
                break;

            case 0:
                saveData();
                printf("Calculator closed.\n");
                break;

            default:
                printf("Invalid option!\n");
        }

    } while (choice != 0);

    return 0;
}
