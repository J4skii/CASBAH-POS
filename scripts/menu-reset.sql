connect 'jdbc:derby:data/posdb;user=app;password=app;';

delete from MENU_ITEM;
delete from MENU_GROUP;
delete from MENU_CATEGORY;

commit;
disconnect;
exit;
